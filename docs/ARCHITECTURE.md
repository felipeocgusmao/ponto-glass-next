# Architecture

Visão técnica do PontoGlass — fluxos, camadas e decisões de design.

---

## Visão geral

```mermaid
flowchart LR
  U[Browser / PWA] --> M[middleware.ts<br/>JWT signature]
  M -->|rotas privadas| P[App Router pages]
  M -->|rotas privadas| API[API routes]
  P --> API
  API --> AUTH[lib/apiAuth.ts<br/>signature + active + sessions_valid_from]
  AUTH --> DB[(Supabase<br/>PostgreSQL)]
  API --> EMAIL[lib/email.ts<br/>Graph API / SMTP]
  API --> PUSH[Web Push<br/>VAPID]
  CRON[Vercel Cron] --> API
  SDK[Sentry] -.-> P
  SDK -.-> API
```

- **Edge middleware** — valida apenas a assinatura do JWT (sem DB), redireciona não-autenticados para `/login`, encaminha por role (`admin`/`manager` → `/admin`, `employee` → `/ponto`).
- **API routes** — verificação completa via `verifyApiAuth` (sig + utilizador ativo + `sessions_valid_from` ≥ `iat` do token).
- **Supabase** — única fonte de verdade. As routes correm com a `service_role` key, RLS desativada por simplicidade (proteção é feita por role via middleware + apiAuth).
- **Vercel Cron** — endpoints `/api/cron/absence-check` e `/api/cron/missing-exit` protegidos por `Bearer ${CRON_SECRET}`.
- **GitHub Actions Cron** — `/api/cron/entry-reminder` chamado a cada 5 min em dias úteis (Vercel Hobby não suporta cron sub-diário; ver `.github/workflows/entry-reminder.yml`).

---

## Estrutura de pastas

```
app/
├─ page.tsx                    redirect inteligente (admin → /admin | employee → /ponto)
├─ login/page.tsx              split-screen (brand + form), 5 tentativas/15min
├─ admin/
│  ├─ page.tsx                 shell admin (sidebar + topbar + tabs)
│  ├─ _components/             Sidebar, TopBar, CommandPalette, NotificationsDropdown,
│  │                           SettingsModal, MissingExitBanner, tabs/*
│  └─ _lib/                    helpers (getWorkState, calcLiveMin, useNotifications)
├─ ponto/
│  ├─ page.tsx                 shell funcionário (fullscreen, 5 tabs)
│  └─ _components/CalendarView calendário mensal do histórico
├─ kiosk/
│  ├─ page.tsx                 modo quiosque (tablet partilhado, sem login individual)
│  └─ glass/page.tsx           variante smart-glasses (640×400, alto contraste, D-pad + voz)
├─ demo/page.tsx               página pública de credenciais demo (noindex)
└─ api/                        ver lista abaixo

lib/
├─ auth.ts                     createJWT / verifyJWT(WithMeta) / reset tokens
├─ apiAuth.ts                  verifyApiAuth (sig + active + sessions_valid_from)
├─ supabase.ts                 cliente único (service_role)
├─ rateLimit.ts                KV/Upstash + fallback em memória
├─ audit.ts                    helper para audit_logs
├─ email.ts                    Microsoft Graph (preferido) + SMTP fallback
├─ i18n.ts + LangContext       4 idiomas (PT-PT, PT-BR, EN, ES)
├─ types.ts                    Employee, PunchRecord, CorrectionRequest, AuditLog, etc.
├─ punchValidation.ts          validateGeofence / isDuplicatePunch / isValidPunchType
├─ punchQueue.ts               fila offline (localStorage + flush ao reconectar)
├─ voice.ts                    parseVoiceCommand / getSpeechRecognition / speak (TTS)
├─ entryReminder.ts            seleciona quem precisa de lembrete (chamado pelo cron server-side)
└─ utils.ts                    calcHours / calcNetMinutes / fmtCentesimal / roundToQuarter / exportCSV / exportPDF

middleware.ts                  edge: signature-only auth + role-based redirects
public/sw.js                   service worker (cache + web push + Background Sync da fila offline)
vercel.json                    cron jobs (absence-check 09:00 + missing-exit 17:00 UTC)
.github/workflows/
├─ ci.yml                      lint + test + build
└─ entry-reminder.yml          cron */5 * * * 1-5 → POST /api/cron/entry-reminder
supabase/
├─ schema.sql                  schema completo + migrações v1→v10 comentadas
└─ migrations/                 migrações datadas (geofencing, RLS, backfill, etc.)
```

---

## Autenticação

### Fluxo de login

```mermaid
sequenceDiagram
  participant U as Browser
  participant L as POST /api/auth/login
  participant DB as Supabase
  U->>L: { username, password }
  L->>L: rateLimit(IP, 5/15min)
  L->>DB: SELECT * FROM employees WHERE username=? AND active=true
  DB-->>L: row + password_hash
  L->>L: bcrypt.compare
  L->>L: createJWT (HS256, 8h, iat=now)
  L-->>U: Set-Cookie: ponto_token (httpOnly, secure, sameSite=lax, maxAge=8h)
  U->>U: router.push(role==employee ? /ponto : /admin)
```

### Fluxo por request (rota privada)

```mermaid
sequenceDiagram
  participant U as Browser
  participant MW as middleware (edge)
  participant API as API route
  participant AUTH as verifyApiAuth
  participant DB as Supabase
  U->>MW: GET /admin (cookie: ponto_token)
  MW->>MW: verifyJWT(token)  // só assinatura
  MW-->>U: NextResponse.next()
  U->>API: GET /api/me
  API->>AUTH: verifyApiAuth(token)
  AUTH->>AUTH: verifyJWTWithMeta  (sig + iat)
  AUTH->>DB: SELECT active, sessions_valid_from FROM employees
  AUTH->>AUTH: active && iat ≥ sessions_valid_from
  AUTH-->>API: { user }
  API->>DB: SELECT profile
  API-->>U: { profile }
```

### Revogação

- **Logout** (`POST /api/auth/logout`): apaga cookie + `UPDATE employees SET sessions_valid_from = NOW()`. Todos os tokens com `iat < NOW` deixam de ser aceites.
- **Troca/reset de senha**: emite o mesmo `UPDATE` e re-emite o token (back-dated 2s) para o utilizador continuar logado.
- **Resiliência**: se a coluna `sessions_valid_from` ainda não existir (migração não aplicada), `verifyApiAuth` degrada para signature-only — não tranca ninguém.

### Tokens de reset de senha

- TTL: 1h.
- Claim `pwh` = SHA-256(password_hash atual) truncado a 16 hex → uso único (qualquer troca de senha invalida o link).

---

## Modelo de permissões (RBAC)

Três roles definidos em `employees.role`, mais um flag de plataforma:

| Role     | Áreas | Pode |
|----------|-------|------|
| `employee` | `/ponto` | Bater ponto próprio, ver histórico/calendário, solicitar correções, ver banco de horas próprio |
| `manager`  | `/admin` (tabs OPERAÇÃO + PESSOAS – Funcionários + ANÁLISE – Auditoria) | Monitorizar status ao vivo, registar ponto por qualquer funcionário, aprovar/rejeitar correções, gerir banco de horas, gerir feriados, ver relatórios |
| `admin`    | `/admin` (todos os tabs do seu tenant) | Tudo do manager + CRUD de funcionários + audit log + reset de senha de outros + lock_profile |
| `admin + super_admin` | aba **Empresas** extra | Listar/criar/editar/desativar tenants, ver a URL pública de cada um |

Enforcement:
- **Edge middleware**: redireciona empregados para `/ponto`, admins para `/admin`.
- **Cada API route**: chama `verifyApiAuth` e valida `user.role` quando relevante (`if (!['admin','manager'].includes(user.role)) return 403`).
- **`super_admin`** é lido do banco em cada request via `verifyApiAuth` — nunca confiado ao token (revogar o flag tem efeito imediato).

---

## Multi-tenancy

Implementado em 5 fases — uma instância serve N empresas com isolamento completo.

### Resolução do tenant (no login, fluxos de password e cron)

```mermaid
sequenceDiagram
    autonumber
    participant U as Browser (host=X)
    participant L as POST /api/auth/login
    participant T as resolveLoginTenant
    participant DB as Supabase

    U->>L: { username, password }
    L->>T: host = X
    T->>DB: SELECT id FROM tenants WHERE domain = X
    alt domínio custom registado
      DB-->>T: tenant_id
    else <slug>.<NEXT_PUBLIC_TENANT_ROOT_DOMAIN>
      T->>DB: SELECT id FROM tenants WHERE slug = <slug>
      alt slug existe
        DB-->>T: tenant_id
      else slug desconhecido
        DB-->>T: null
        T-->>L: null
        L-->>U: 404 "Empresa não encontrada"
      end
    else apex / www / localhost / preview
      T-->>L: DEFAULT_TENANT_ID
    end
    L->>DB: SELECT * FROM employees WHERE tenant_id=... AND username=... AND active
    DB-->>L: row | null
    L-->>U: JWT { ..., tenant_id } | 401
```

Detalhes em [`docs/TENANTS.md`](./TENANTS.md). Implementação em `lib/tenant.ts`.

### Isolamento entre subdomínios

Não depende do middleware fazer lookup ao banco em cada request:

- O cookie `ponto_token` é **host-only** (sem atributo `Domain`), então o browser nunca o envia para um subdomínio irmão.
- Toda query da API filtra por `.eq('tenant_id', user.tenant_id)` — `tenant_id` vem do JWT mas é re-carregado do banco por `verifyApiAuth`. Um token forjado com outro `tenant_id` não dá acesso ao tenant alvo: a DB é a fonte de verdade.
- RLS bloqueia totalmente o role `anon` (defesa em profundidade) — apenas o `service_role` server-side passa.

### Crons multi-tenant

```mermaid
flowchart LR
  Trigger[Vercel Cron / GitHub Actions] --> Loop[for tenant in activeTenantIds]
  Loop --> RunT[runTenant tenantId]
  RunT --> Filter[Queries com .eq tenant_id]
  Filter --> Push[Web Push apenas aos admins desse tenant]
  Filter --> Email[Relatório mensal apenas aos emails desse tenant]
  Filter --> Audit[(audit_logs com tenant_id correto)]
```

`activeTenantIds()` (em `lib/tenant.ts`) faz `SELECT id FROM tenants WHERE active = true`, com fallback para `[DEFAULT_TENANT_ID]` em DBs pré-migração — single-tenant continua a funcionar idêntico.

### Decisões notáveis sobre tenancy

- **`tenant_id` com `DEFAULT` + backfill na fase 1** — INSERTs antigos continuam a funcionar sem mudar código, até a fase 2 passar a injectar `tenant_id` explicitamente. Migração reversível por fase.
- **Slug imutável após criação** — é a URL da empresa; renomear quebraria bookmarks, PWAs instalados e push subscriptions.
- **Default tenant não pode ser desativado** — os super-admins vivem nele.
- **Super-admin é um flag, não uma role** — preserva todos os poderes de admin dentro do tenant default mais a aba Empresas; backfill na migração v14 marca os admins ativos do default tenant que já eram, de facto, os operadores da plataforma antes da multi-tenancy.

---

## Ciclo de registo de ponto

```mermaid
flowchart TD
  Punch[/Bate Entrada/]:::action --> Geo{geo_mode === 'required'?}
  Geo -- sim --> CheckGPS[Recolhe lat/lng do browser]
  CheckGPS --> Distance[Haversine vs workplace_lat/lng]
  Distance -- dentro de max_distance_meters --> Insert
  Distance -- fora --> Reject[400 Fora do local]
  Geo -- não --> Insert
  Insert[(INSERT INTO records<br/>employee_id, type, timestamp,<br/>date=calcWorkDate, lat/lng)]
  Insert --> RateLimit{Próximo punch ≥ 60s<br/>do anterior do mesmo tipo?}
  RateLimit -- não --> Reject2[409 Duplicado]
  RateLimit -- sim --> Audit[logAudit punch_on_behalf<br/>se admin/manager]
  classDef action fill:#7c8cf8,stroke:#5e6ad2,color:#fff;
```

### Date stamping

`calcWorkDate(timestamp, shift_start)` devolve o "dia de trabalho" no fuso configurado (`NEXT_PUBLIC_BUSINESS_TZ`, padrão `Europe/Madrid`). Para turnos noturnos (`shift_start='22:00'`), uma entrada às 23:30 conta para o **dia da entrada**, não para o dia seguinte.

### Tipos de batida

- Trabalho: `entrada`, `fim_almoco`, `retorno_cafe` (qualquer destes a "abrir" sessão)
- Pausa: `inicio_almoco`, `pausa_cafe`
- Saída: `saída` (com acento)

### Cálculo de horas

- `calcTimeBreakdown(recs)` — usa pares explícitos de entrada/saída + inicio_almoco/fim_almoco + pausa_cafe/retorno_cafe.
- `calcLiveMin(recs, lunchAuto)` — para display em tempo real durante a jornada. Quando o trabalhador está em serviço, não pré-deduz `lunch_break_minutes` (mostra tempo bruto). Após `saída`, deduz como fallback para quem não regista pausas explícitas.
- `calcWorkedMinutesPeriod` / `calcOvertimePeriod` — para relatórios e payslip; calcula líquido com lunch deduzido quando o dia está fechado.

### Validação extraída (lib/punchValidation.ts)

Para tornar a validação testável sem mockar Supabase/cookies/JWT, três helpers puros vivem fora do route handler:

- `validateGeofence({ geoMode, latitude, longitude, workplaceLat, workplaceLng, maxDistanceMeters })` — devolve `{ ok: true }` ou `{ ok: false; status; error }`.
- `isDuplicatePunch(lastType, lastTs, newType, now, windowMs=60_000)` — bloqueia duplo-tap mantendo trocas legítimas (`entrada` → `saída`).
- `isValidPunchType(t)` — type guard para a union dos 6 tipos aceites.

O route `/api/punch` chama-os antes de inserir; ver `__tests__/punchValidation.test.ts` para a tabela de casos.

---

## Camada de display centesimal

As batidas no banco continuam intactas (timestamps em UTC, precisão de milissegundos). A apresentação "centesimal" é uma camada de *read-time*:

```mermaid
flowchart LR
  R[records] --> CD[calcDayRounded<br/>por dia]
  CD --> RQ[roundToQuarter<br/>para múltiplo de 15min mais próximo]
  RQ --> FC[fmtCentesimal<br/>7h45 → '7,75']
  FC --> UI[Relatórios / Banco / Payslip / CSV / PDF]
  R --> CR[calcLiveMin<br/>cronómetro ao vivo]
  CR --> RAW[mm:ss exato no /ponto]
```

- **Arredondamento por dia**, não pelo total do mês — o somatório das linhas bate sempre com o total.
- **Live continua exato** — o cronómetro no `/ponto` mostra `mm:ss` em tempo real para não confundir o trabalhador.
- Usado em: `RelatoriosTab`, `BancoHorasTab`, `MeuPontoTab`, holerite, exportCSV, exportPDF, email mensal.

---

## Modo Glass + voz (kiosk/glass)

Variante do quiosque otimizada para óculos Android (ex: Vuzix Blade). Resolução 640×400, alto contraste, navegação por D-pad/teclado, batida com contagem regressiva de 3s cancelável.

```mermaid
sequenceDiagram
  participant U as User
  participant G as /kiosk/glass
  participant V as Web Speech API
  participant A as POST /api/punch
  U->>G: tecla M (ou clique 🎙)
  G->>V: SpeechRecognition.start()
  U->>V: "Maria entrada"
  V-->>G: transcript
  G->>G: parseVoiceCommand → { kind: 'select-and-punch', employeeId, type }
  G->>A: POST { type, employeeId }
  A-->>G: 200 OK
  G->>V: SpeechSynthesisUtterance "Entrada registada para Maria."
```

- Reconhece nomes parciais e sem acentos (`"joao"` ≈ `"João"`), sinónimos (`"almoço"`, `"voltei do almoço"`, `"pausa"`), e o comando `"cancelar"`.
- Fallback gracioso — se a Web Speech API não existe (Firefox), o botão 🎙 não é renderizado e o fluxo D-pad continua a funcionar.

---

## Fila offline (lib/punchQueue.ts + sw.js)

Quando o dispositivo perde rede, a batida fica em `localStorage` em vez de erro:

```mermaid
flowchart TD
  Click[Click bater ponto] --> Online{navigator.onLine?}
  Online -- sim --> POST[POST /api/punch]
  POST -- ok --> Done[Render confirmação]
  POST -- fail --> Enqueue
  Online -- não --> Enqueue[enqueue → localStorage<br/>+ navigator.serviceWorker<br/>  .sync.register punch-queue]
  Enqueue --> Indicator[Indicador 'pendentes' no UI]
  SW[Service Worker] -- sync event --> Flush[flushQueue<br/>POST cada item]
  Flush -- ok --> Clear[dequeue + 'queue synced' toast]
```

- A subscrição de `sync` é feita em `public/sw.js` (tag `punch-queue`).
- Cada item: `{ id, type, latitude?, longitude?, timestamp }`. O servidor aceita timestamps históricos (útil para batidas atrasadas pelo offline).

---

## Lembrete de entrada (server-side cron)

Cron de 5 minutos hospedado em GitHub Actions (`.github/workflows/entry-reminder.yml`) porque Vercel Hobby não permite agendamentos sub-diários. Em dias úteis chama `POST /api/cron/entry-reminder` com `Bearer ${CRON_SECRET}`.

```mermaid
sequenceDiagram
  participant GA as GitHub Actions
  participant API as /api/cron/entry-reminder
  participant DB as Supabase
  participant WP as Web Push (VAPID)
  GA->>API: Bearer CRON_SECRET
  API->>DB: SELECT employees onde expected_start está nos próximos 60min<br/>AND não bateu 'entrada' hoje
  API->>WP: enviar push para cada subscription
  API-->>GA: { notified: N, due: M }
```

- `lib/entryReminder.ts` tem a lógica pura (selecionar quem precisa) — testada em `__tests__/entryReminder.test.ts`.
- O workflow degrada para *skip with warning* quando `APP_URL`/`CRON_SECRET` não estão configurados (não falha o repo).

---

## API surface

```
/api/auth/
  ├─ login            POST  bcrypt + JWT + cookie + rate limit
  ├─ logout           POST  apaga cookie + revoga tokens (sessions_valid_from=NOW)
  ├─ password         PUT   troca de senha (re-emite token back-dated 2s)
  ├─ forgot-password  POST  envia link de reset (1h)
  ├─ reset-password   POST  valida token + redefine senha
  └─ recover          POST  reset de emergência via RECOVERY_SECRET (não-admins)

/api/me               GET   perfil completo (com fallback para colunas em falta)
                      PATCH theme / email

/api/punch            POST  regista batida (suporta on-behalf para admin/manager)

/api/records          GET   ?today=true | ?employeeId=X
                      POST  registar batida manual (admin)
/api/records/[id]     PATCH editar timestamp/comment
                      DELETE remover

/api/employees        GET   listar ativos
                      POST  criar (admin)
/api/employees/[id]   PATCH update (role, lock_profile, password, etc)
                      DELETE soft-delete (active=false)

/api/hour-bank        GET   ?employeeId=X (saldo + ajustes)
                      POST  novo ajuste manual
/api/hour-bank/[id]   DELETE remover ajuste

/api/correction-requests   GET/POST  listar + criar
/api/correction-requests/[id] PATCH  aprovar / rejeitar

/api/day-exceptions   GET/POST  feriados e folgas (global ou por funcionário)
/api/day-exceptions/[id] DELETE

/api/reports          GET   ?from=YYYY-MM-DD&to=YYYY-MM-DD (máx 366 dias, ≤ 2000 rows)
/api/audit            GET   logs (admin)
/api/push-subscribe   POST  guarda subscription VAPID do browser

/api/cron/
  ├─ absence-check    GET   09:00 UTC dias úteis (Vercel cron, Bearer CRON_SECRET)
  ├─ missing-exit     GET   17:00 UTC dias úteis (Vercel cron, Bearer CRON_SECRET)
  ├─ entry-reminder   POST  */5 * * * 1-5 (GitHub Actions, Bearer CRON_SECRET)
  └─ monthly-report   POST  1º dia do mês (Vercel cron, Bearer CRON_SECRET)
```

---

## Schema do banco

Ver `supabase/schema.sql` para o SQL completo. Tabelas principais:

```
employees                  perfil + role + horário + valor/h + tema + sessions_valid_from
records                    batida (employee_id, type, timestamp, date, lat/lng, comment)
hour_bank_adjustments      ajustes manuais (minutes signed + reason)
correction_requests        pedido de funcionário (status: pending|approved|rejected)
day_exceptions             feriados/folgas (global se employee_id NULL, senão por funcionário)
push_subscriptions         VAPID subscriptions por funcionário
audit_logs                 trilha de ações administrativas (JSONB details)
```

Versionamento:
- `supabase/schema.sql` — schema completo + migrações v1→v10 comentadas em ordem.
- `supabase/migrations/*.sql` — migrações datadas individuais (mais granulares). Idempotentes (`IF NOT EXISTS`).

---

## Frontend

### Design system

- CSS puro (sem Tailwind). `app/globals.css` define `--bg`, `--accent`, `--fg`, `--success-*`, `--danger-*`, etc. para temas `light` e `[data-theme="dark"]`.
- Componentes de layout: `.app[data-collapsed]`, `.sidebar`, `.topbar`, `.page`, `.page-head`, `.card`, `.kpi-grid`, `.status-row`, `.filter-bar`, `.filter-pill`, `.seg`, `.chip`.
- Avatares: `.avatar.size-22/28/30/36/48/64` + cor por hash do ID (`av-c1`...`av-c8`).
- Mobile: sidebar fica em drawer (≤768px), tabelas com `overflow-x: auto`, colunas com `data-col="X"` que são escondidas/encolhidas via media queries.

### Atalhos

- **⌘K / Ctrl+K** — abre Command Palette (navegação por teclado + ações rápidas)
- **Esc** — fecha modal / palette / drawer
- **Clicar no avatar** (admin sidebar / ponto topbar) — abre Settings Modal

### State management

Sem Redux/Zustand. State local com `useState`/`useEffect`. Padrões recorrentes:

- **Live data**: `useEffect` com `setInterval(load, 60_000)` + refetch em `focus` e no evento `pg:records-changed` (dispatched após cada POST/PATCH/DELETE de record).
- **Out-of-order responses**: `loadSeq` com `useRef` para ignorar respostas atrasadas de fetches anteriores.
- **Cleanup**: todos os intervals/listeners têm `return () => { ... }` no useEffect.

---

## i18n

`lib/i18n.ts` define `TRANSLATIONS: Record<Lang, Record<TranslationKey, string>>` com 4 idiomas (`pt-PT`, `pt-BR`, `en`, `es`). `LangContext` expõe `t(key)` e `setLang(l)`. A escolha persiste em `localStorage` (`pg.lang`).

A escolha inicial é detectada via `navigator.language` na primeira visita.

---

## Observabilidade

- **Sentry** (`sentry.client.config.ts` + `sentry.server.config.ts`) — captura erros cliente e servidor. Source maps via `withSentryConfig` no `next.config.mjs`.
- **Vercel Analytics** + **Speed Insights** — métricas de performance e tráfego.
- **Audit log** — toda a acção administrativa cria uma linha em `audit_logs` (criar/remover funcionário, ajustar banco de horas, aprovar correção, etc).

---

## Decisões notáveis

| Decisão | Motivo |
|---------|--------|
| JWT em httpOnly cookie | XSS-safe (JS não lê), funciona em SSR e API |
| Edge middleware só com signature | Latência mínima, sem DB hops por request |
| Verificação completa só nas API routes | Custo aceitável (já há query ao DB), permite revogação fina |
| Service role key só no servidor | Cliente nunca tem permissões diretas no DB |
| Sem RLS no Postgres | Simplicidade — proteção é centralizada nas API routes |
| Records.date no fuso local | Relatórios consistentes para a empresa, independente do fuso do servidor |
| Lunch deduction só após saída | Display ao vivo mostra tempo bruto (não confunde o trabalhador) |
| Soft delete de funcionários | Preserva histórico de records e audit logs |
| `.maybeSingle()` + fallback nas queries | Tolerância a migrações pendentes em produção |
| Centesimal aplicado em read-time | Records intactos; só a apresentação muda — sem migração de dados |
| Validação de punch extraída para `lib/punchValidation.ts` | Permite testes unitários sem mockar Supabase/cookies/JWT |
| Cron de entry-reminder em GitHub Actions | Vercel Hobby não suporta cron sub-diário; GHA dá 5min sem custos |
| Fila offline em `localStorage` + Background Sync | Sobrevive a refresh; flush automático ao reconectar — sem perder batidas |
