<div align="center">

```
██████╗  ██████╗ ███╗   ██╗████████╗ ██████╗ 
██╔══██╗██╔═══██╗████╗  ██║╚══██╔══╝██╔═══██╗
██████╔╝██║   ██║██╔██╗ ██║   ██║   ██║   ██║
██╔═══╝ ██║   ██║██║╚██╗██║   ██║   ██║   ██║
██║     ╚██████╔╝██║ ╚████║   ██║   ╚██████╔╝
╚═╝      ╚═════╝ ╚═╝  ╚═══╝   ╚═╝    ╚═════╝ 
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 ██████╗ ██╗      █████╗ ███████╗███████╗    
██╔════╝ ██║     ██╔══██╗██╔════╝██╔════╝    
██║  ███╗██║     ███████║███████╗███████╗    
██║   ██║██║     ██╔══██║╚════██║╚════██║    
╚██████╔╝███████╗██║  ██║███████║███████║    
 ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝   
```

*░ ░ ░  o tempo, finalmente, tem forma  ░ ░ ░*

<br/>

*Cada segundo que passa deixa uma marca.*  
*PontoGlass transforma esse instante invisível em algo que você pode ver,*  
*tocar — transparente como vidro, preciso como o tempo.*

<br/>

[![CI](https://img.shields.io/github/actions/workflow/status/felipeocgusmao/ponto-glass-next/ci.yml?branch=master&style=for-the-badge&label=CI)](https://github.com/felipeocgusmao/ponto-glass-next/actions/workflows/ci.yml)
[![Deploy](https://img.shields.io/badge/deploy-vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://ponto-glass-next.vercel.app)
[![Next.js](https://img.shields.io/badge/next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/supabase-postgresql-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-a855f7?style=for-the-badge)](LICENSE)

<br/>

**[→ Acessar o sistema ao vivo](https://ponto-glass-next.vercel.app)**

</div>

---

<br/>

## ░ manifesto

```
O relógio não para.
Não importa se você está dentro ou fora.
Não importa se o sistema está ligado ou desligado.

O tempo avança — silencioso, indiferente, absoluto.

PontoGlass não tenta domar o tempo.
Apenas o registra.
Com a elegância de quem entende que transparência
é a única forma honesta de existir.
```

> *Feito para empresas que acreditam que controle e confiança*  
> *não precisam ser opostos.*

<br/>

---

## ◈ o que é isso

**PontoGlass** é um sistema de controle de ponto digital — leve, seguro e bonito — construído para funcionar em qualquer lugar do planeta, sem instalação, sem servidor próprio, sem complicação.

Um funcionário abre o link no celular. Bate o ponto. Pronto.  
O admin vê tudo, em tempo real, de qualquer lugar.

Não existe banco de dados local. Não existe arquivo JSON perdido no desktop.  
Existe **um URL** e **uma senha**.

<br/>

---

## ◈ stack

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Frontend    →   Next.js 14  (App Router)              │
│   Linguagem   →   TypeScript  (strict)                  │
│   Estilo      →   CSS Variables  (sem Tailwind)         │
│   Auth        →   JWT em httpOnly cookie  (8 horas)     │
│   Banco       →   Supabase  (PostgreSQL gerenciado)     │
│   Senhas      →   bcryptjs  (hash + salt)               │
│   Push        →   Web Push API  (VAPID)                 │
│   E-mail      →   Microsoft Graph API  (+ SMTP fallback)│
│   PDF         →   jsPDF + jsPDF-AutoTable  (client)     │
│   Cron        →   Vercel Cron Jobs  (ausências, saída)  │
│   Testes      →   Vitest  (utils, auth, rateLimit)      │
│   Monitor     →   Sentry  (erros cliente + servidor)    │
│   Geofencing  →   Haversine  (raio por funcionário)     │
│   Deploy      →   Vercel  (Edge Network global)         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Cada peça foi escolhida com intenção:

| Peça | Motivo |
|------|--------|
| **Next.js App Router** | Server + client components onde faz sentido; sem overhead |
| **Supabase** | PostgreSQL real, backups automáticos, sem DevOps |
| **Jose (JWT)** | Edge-compatible — funciona nas Vercel Edge Functions |
| **bcryptjs** | Senhas nunca saem do servidor em texto plano |
| **CSS Variables** | Design system próprio — tema claro/escuro, sem dependências de UI |
| **Web Push / VAPID** | Notificações nativas no celular sem app store |
| **Microsoft Graph + SMTP** | Graph API como transporte principal (OAuth Client Credentials), SMTP como fallback automático |
| **jsPDF + AutoTable** | Geração de PDF no cliente, sem dependências de servidor |
| **Vercel Cron Jobs** | Tarefas agendadas: alerta de ausência (manhã) e alerta de saída não registada (17h) |
| **Vitest** | Testes unitários rápidos para a lógica de cálculo de horas, auth e rate limit |
| **Sentry** | Captura de erros e source maps automáticos via `withSentryConfig` |
| **Haversine** | Cálculo de distância para validação opcional de geofencing por funcionário |

<br/>

---

## ◈ funcionalidades

```
  FUNCIONÁRIO                          GERENTE                              ADMINISTRADOR
  ───────────                          ───────                              ─────────────
  ● Relógio ao vivo                    ● Painel de status ao vivo           ● Tudo do Gerente
  ● Status: dentro / pausa / fora      ● Ver quem está em serviço agora     ● Cadastrar e remover funcionários
  ● Registrar entrada / saída          ● Ver ganhos de cada funcionário      ● Configurar jornada (4–10h)
  ● Pausas: Almoço / Café / Retorno    ● Registrar ponto por funcionário    ● Configurar desconto de almoço
  ● Horas trabalhadas ao vivo          ● Histórico de registros             ● Definir valor/hora em €
  ● Ganhos do dia em tempo real        ● Banco de horas por funcionário     ● Redefinir senha de qualquer usuário
  ● Desconto de almoço automático*     ● Relatórios por período             ● Alterar nome de usuário
  ● Horas extras acumuladas            ● Exportar CSV profissional          ● Criar usuários (funcionário/gerente/admin)
  ● Banco de horas pessoal             ● Exportar PDF profissional          ● Audit log de ações administrativas
  ● Solicitar correção de registo      ● Gerir feriados e folgas            ● Gerir solicitações de correção
  ● Notificações push de fim jornada   ● Aprovar/rejeitar correções         ● Configurar geo por funcionário
  ● Histórico mensal (lista)           ● Dashboard com gráficos             ● Bloquear perfil de funcionário
  ● Vista calendário mensal            ● Alerta de saídas em falta          ● Ajustar banco de horas manualmente
  ● Trocar senha                       ● Quiosque de ponto                  ● Definir horário esperado por func.
  ● Selector de idioma (PT/BR/EN/ES)   ● Push de ausência (cron 09h UTC)    ● Comentário em qualquer registo
  ● Tema claro/escuro (persiste)       ● Comentários em registos
```

*\*desconto automático só se aplica quando pausas explícitas não foram registradas (fallback legado)*

**Auto-seed:** no primeiro login, o sistema cria o usuário `admin` automaticamente.  
Nenhuma configuração manual de banco necessária.

**Recuperação de emergência:** rota `/api/auth/recover` com `RECOVERY_SECRET` para quando o admin perde o acesso.

**Modo Quiosque:** página `/kiosk` para tablet/ecrã compartilhado — qualquer funcionário bate o ponto sem fazer login individual.

<br/>

---

## ◈ design

O visual foi construído do zero em CSS puro — sem bibliotecas de UI, sem componentes prontos.  
Inspirado no minimalismo do Linear, Notion e VSCode: estrutura clara, hierarquia legível, zero ruído.

```css
/* o sistema de cores — claro e escuro via atributo */
:root                { --bg: #fafafa; --accent: #5e6ad2; --fg: #18181b; }
[data-theme="dark"]  { --bg: #08090b; --accent: #7c8cf8; --fg: #fafafa; }

/* sidebar + conteúdo — 100dvh para iOS Safari (barra de endereço dinâmica) */
.app   { display: grid; grid-template-columns: var(--sidebar-w, 240px) 1fr; height: 100dvh; }
.app[data-collapsed="true"] { --sidebar-w: 56px; }
```

**Admin shell** — sidebar agrupada (OPERAÇÃO / PESSOAS / ANÁLISE), botão de colapsar com persistência em `localStorage`, topbar com breadcrumbs, busca **⌘K** que abre uma **Command Palette** (navegação + ações), **Notifications Dropdown** no sino (correções pendentes, saídas em falta, ausências) e um **Settings Modal** centralizado para tema, idioma, palavra-passe e logout.

**Page-head** consistente em todos os tabs: título, subtítulo dinâmico (contagem ou estado) e botões de ação (Atualizar, Exportar, etc.).

**Employee shell** — ecrã `/ponto` em layout fullscreen com relógio ao vivo, anel de progresso, ações contextuais (entrada / almoço / pausa / saída) e navegação inferior por 5 tabs (Ponto, Histórico, Banco, Correções, Perfil).

Tema claro/escuro com um clique — persiste via `localStorage` e no banco por funcionário.  
Cores de avatar (`av-c1` → `av-c8`) atribuídas por hash do ID, sem campo extra no banco.  
Interface totalmente responsiva: sidebar em drawer mobile (≤768px), colunas ocultas/encolhidas em ecrãs estreitos, layout específico ≤480px.

<br/>

---

## ◈ i18n

O sistema suporta 4 idiomas, selecionável por cada utilizador:

| Código | Idioma |
|--------|--------|
| `pt-PT` | Português (Portugal) — padrão |
| `pt-BR` | Português (Brasil) |
| `en` | English |
| `es` | Español |

A deteção é automática (via `navigator.language` + `localStorage`). Todas as strings estão em `/lib/i18n.ts`.

<br/>

---

## ◈ arquitetura

```
ponto_glass_next/
│
├── app/
│   ├── page.tsx                  ← redirect inteligente (admin/manager → /admin | employee → /ponto)
│   ├── login/page.tsx            ← autenticação (split-screen com relógio animado)
│   ├── reset-password/page.tsx   ← reset de senha via link de e-mail
│   ├── ponto/page.tsx            ← shell fullscreen do funcionário (relógio, histórico, banco, correções)
│   │   └── _components/
│   │       └── CalendarView      ← grelha de mês com dias coloridos (trabalhado/ausente/feriado)
│   ├── kiosk/page.tsx            ← modo quiosque (tablet compartilhado, sem login individual)
│   ├── admin/page.tsx            ← painel admin/gerente (sidebar agrupada, 10 abas por role)
│   │   ├── _lib/
│   │   │   └── useNotifications  ← hook que agrega correções pendentes, saídas em falta, ausências
│   │   └── _components/
│   │       ├── Sidebar           ← grupos OPERAÇÃO / PESSOAS / ANÁLISE, colapsável, drawer mobile
│   │       ├── TopBar            ← breadcrumbs + ⌘K + tema + sino com badge
│   │       ├── CommandPalette    ← navegação por teclado e ações rápidas (⌘K / Ctrl+K)
│   │       ├── NotificationsDropdown  ← popover do sino: correções, saídas em falta, ausências
│   │       ├── SettingsModal     ← tema, idioma, palavra-passe, sair
│   │       └── tabs/
│   │           ├── MeuPontoTab       ← ponto do admin/gerente logado
│   │           ├── DashboardTab      ← KPIs, sparkline, gráfico 14 dias, feed de batidas, atrasos
│   │           ├── StatusTab         ← status ao vivo, toggle Lista/Cards, detecta sessões abertas de ontem
│   │           ├── RegistrosTab      ← search + tipo + range pills (Hoje/7d/14d/30d), agrupado por data
│   │           ├── FuncionariosTab   ← filter bar + tabela densa + drawer de configurações
│   │           ├── BancoHorasTab     ← KPI grid, tabela com trend bars centradas em zero
│   │           ├── FeriadosTab       ← toggle Lista/Calendário (grelha mensal navegável)
│   │           ├── RelatoriosTab     ← KPI summary, quick range pills, tabela por funcionário (Resumo/Detalhado)
│   │           ├── CorrecoesTab      ← aprovar/rejeitar solicitações de correção
│   │           └── AuditoriaTab      ← search + filtro de ator + exportar JSON
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/            ← bcrypt + JWT + cookie + rate limit
│       │   ├── logout/           ← limpa cookie
│       │   ├── password/         ← troca de senha autenticada
│       │   ├── forgot-password/  ← envia link de reset por e-mail
│       │   ├── reset-password/   ← valida token e redefine senha
│       │   └── recover/          ← reset de emergência via RECOVERY_SECRET
│       ├── me/                   ← perfil completo + PATCH (tema, e-mail, geo_mode)
│       ├── punch/                ← registra ponto (admin pode registrar por outros)
│       ├── records/              ← lista / edita / remove registros + comentários
│       │   └── [id]/
│       ├── employees/            ← CRUD funcionários + horário esperado + turno noturno
│       │   └── [id]/
│       ├── cron/
│       │   ├── absence-check/    ← push de ausência (protegido por CRON_SECRET)
│       │   └── missing-exit/     ← alerta de saída não registada às 17h (protegido por CRON_SECRET)
│       ├── hour-bank/            ← saldo do banco de horas + ajustes manuais
│       │   └── [id]/
│       ├── correction-requests/  ← criar / listar / aprovar / rejeitar correções
│       │   └── [id]/
│       ├── day-exceptions/       ← feriados e dias de folga (global ou por funcionário)
│       │   └── [id]/
│       ├── push-subscribe/       ← regista subscription VAPID do browser
│       ├── audit/                ← audit log (admin only)
│       └── reports/              ← relatório por período (máx 366 dias)
│
├── components/
│   └── ChangePasswordModal.tsx
│
├── lib/
│   ├── auth.ts               ← createJWT / verifyJWT
│   ├── supabase.ts           ← cliente Supabase (service_role)
│   ├── rateLimit.ts          ← rate limiter em memória (login / recover)
│   ├── audit.ts              ← helper de audit log
│   ├── email.ts              ← Microsoft Graph (preferido) + SMTP fallback
│   ├── i18n.ts               ← traduções PT-PT / PT-BR / EN / ES
│   ├── LangContext.tsx        ← contexto React de idioma
│   ├── types.ts              ← Employee, EmployeeProfile, PunchRecord, CorrectionRequest…
│   └── utils.ts              ← calcHours, calcNetMinutes, calcEarnings, fmtMinutes…
│
├── middleware.ts              ← RBAC: protege rotas por role (admin/manager/employee)
├── public/sw.js               ← Service Worker (cache + push notifications)
├── vercel.json                ← Vercel Cron Jobs (absence-check 09:00 + missing-exit 17:00 UTC)
├── sentry.client.config.ts    ← inicialização Sentry no cliente
├── sentry.server.config.ts    ← inicialização Sentry no servidor
├── vitest.config.ts           ← configuração Vitest (jsdom)
├── __tests__/                 ← testes unitários (utils, auth, rateLimit)
└── supabase/
    ├── schema.sql             ← schema do banco com RLS + migrações comentadas
    └── migrations/            ← migrações datadas (geofencing, RLS policies, backfill)
```

<br/>

---

## ◈ como rodar localmente

### Pré-requisitos

- **Node.js 20+** (ou 18 LTS)
- **npm** 10+ (vem com Node)
- Conta gratuita em [supabase.com](https://supabase.com)
- (opcional) conta em [vercel.com](https://vercel.com) para deploy

### Passo 1 — Clonar e instalar

```bash
git clone https://github.com/felipeocgusmao/ponto-glass-next.git
cd ponto-glass-next
npm install
```

### Passo 2 — Criar o projeto no Supabase

1. Criar projeto novo em [app.supabase.com](https://app.supabase.com)
2. **Project Settings → API**: copiar `Project URL` e `service_role` key
3. **SQL Editor**: copiar e executar o conteúdo de `supabase/schema.sql`
4. (opcional) Aplicar migrações datadas em `supabase/migrations/` na ordem cronológica

> **Banco já existente?** O `schema.sql` inclui blocos `IF NOT EXISTS` idempotentes — pode correr o ficheiro inteiro sem perder dados.

### Passo 3 — Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Mínimo para arrancar:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT — gerar com: openssl rand -base64 32
JWT_SECRET=cole-aqui-uma-string-aleatoria-com-32-caracteres-ou-mais

# Fuso horário da empresa (IANA name)
NEXT_PUBLIC_BUSINESS_TZ=Europe/Madrid

# Senha do admin que será criado no primeiro login (mín. 8 chars)
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=trocar-esta-senha-no-primeiro-login
```

Variáveis adicionais e respetivas instruções estão comentadas no `.env.example` (Vercel KV, VAPID, Microsoft Graph, SMTP, Sentry, recovery).

### Passo 4 — Arrancar

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e faça login com `admin` + `INITIAL_ADMIN_PASSWORD`. **Troque a senha imediatamente** depois do primeiro login (perfil → trocar palavra-passe) e **remova `INITIAL_ADMIN_PASSWORD` do ambiente**.

### Comandos úteis

```bash
npm run dev          # Next.js dev server (turbopack)
npm run build        # Build de produção
npm run start        # Servir o build local
npm run lint         # ESLint
npm test             # Vitest (run once)
npm run test:watch   # Vitest em watch mode
npm run check        # lint + test + build (mesmo que o CI corre)
```

<br/>

---

## ◈ deploy em produção

O projeto está pronto para Vercel com zero configuração extra.

```bash
# instale a CLI do Vercel
npm i -g vercel

# deploy
vercel --prod
```

Configure as variáveis de ambiente no painel da Vercel e pronto.  
A aplicação roda no Edge Network global — latência mínima de qualquer país.

<br/>

---

## ◈ banco de dados

```sql
-- funcionários
employees (
  id                  UUID  PRIMARY KEY,
  name                TEXT,
  username            TEXT  UNIQUE,
  email               TEXT,           ← para recuperação de senha
  password_hash       TEXT,           ← bcrypt, nunca texto puro
  role                TEXT,           ← 'admin' | 'manager' | 'employee'
  active              BOOLEAN,        ← soft delete
  workday_hours       DECIMAL(4,2),   ← jornada configurável (padrão 8h)
  lunch_break_minutes INT,            ← desconto de almoço (padrão 60min)
  hourly_rate         DECIMAL(10,2),  ← valor/hora em € (opcional)
  geo_mode            TEXT,           ← 'required' | 'optional' | 'disabled'
  lock_profile        BOOLEAN,        ← impede o funcionário de alterar perfil
  theme               TEXT,           ← 'dark' | 'light' (persiste no banco)
  expected_start      TIME,           ← hora de entrada esperada (horas flexíveis)
  expected_end        TIME,           ← hora de saída esperada (horas flexíveis)
  shift_start         TIME,           ← início do turno (hora local) — 00:00 = diurno; 22:00 = noturno
  created_at          TIMESTAMPTZ
)

-- registros de ponto
records (
  id            UUID  PRIMARY KEY,
  employee_id   UUID  → employees.id,
  employee_name TEXT,              ← desnormalizado para relatórios
  type          TEXT,              ← 'entrada' | 'saída'
                                      'inicio_almoco' | 'fim_almoco'
                                      'pausa_cafe'    | 'retorno_cafe'
  timestamp     TIMESTAMPTZ,
  date          DATE,              ← índice de busca por dia (ajustado para turno noturno)
  latitude      DECIMAL,           ← opcional (geo_mode)
  longitude     DECIMAL,
  comment       TEXT               ← nota livre do admin/gerente (≤ 500 chars)
)

-- banco de horas (ajustes manuais)
hour_bank_adjustments (
  id          UUID  PRIMARY KEY,
  employee_id UUID  → employees.id,
  minutes     INT,                 ← positivo (crédito) ou negativo (débito)
  reason      TEXT,
  date        DATE,
  created_by  UUID,
  created_at  TIMESTAMPTZ
)

-- solicitações de correção de registo
correction_requests (
  id             UUID  PRIMARY KEY,
  employee_id    UUID  → employees.id,
  employee_name  TEXT,
  req_type       TEXT,             ← tipo de ponto solicitado
  req_timestamp  TIMESTAMPTZ,      ← timestamp solicitado
  req_date       DATE,
  reason         TEXT,
  status         TEXT,             ← 'pending' | 'approved' | 'rejected'
  reviewer_id    UUID,
  reviewer_name  TEXT,
  reviewer_note  TEXT,
  created_at     TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ
)

-- feriados e dias de folga
day_exceptions (
  id          UUID  PRIMARY KEY,
  date        DATE,
  type        TEXT,                ← 'holiday' | 'day_off'
  description TEXT,
  employee_id UUID,                ← NULL = global; UUID = só esse funcionário
  created_by  UUID,
  created_at  TIMESTAMPTZ
)

-- subscriptions de push notifications
push_subscriptions (
  id          UUID  PRIMARY KEY,
  employee_id UUID  → employees.id,
  endpoint    TEXT  UNIQUE,
  p256dh      TEXT,
  auth        TEXT,
  created_at  TIMESTAMPTZ
)

-- audit log
audit_logs (
  id          UUID  PRIMARY KEY,
  actor_id    UUID,
  actor_name  TEXT,
  action      TEXT,
  target_id   UUID,
  target_name TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ
)
```

> O arquivo `supabase/schema.sql` inclui os scripts de migração para bancos existentes.

RLS habilitado em todas as tabelas — acesso via `service_role` apenas no servidor.

<br/>

---

## ◈ segurança

```
  ✓  Senhas com bcrypt (salt automático)
  ✓  JWT assinado com HS256 em httpOnly cookie (inatingível por JS)
  ✓  Middleware de RBAC em todas as rotas sensíveis (admin / manager / employee)
  ✓  Service role key nunca exposta ao cliente
  ✓  Rate limiting: 5 tentativas/15min no login e na recuperação
  ✓  Row Level Security habilitado no Supabase
  ✓  Funcionários só enxergam os próprios registros
  ✓  Soft delete — nenhum dado é apagado permanentemente
  ✓  Proteção ao último administrador (não pode ser removido)
  ✓  Recuperação de emergência via RECOVERY_SECRET
  ✓  Geolocalização opcional/obrigatória/desativada por funcionário
  ✓  Lock de perfil — admin pode impedir que o funcionário altere os próprios dados
  ✓  Push notifications via VAPID (chave privada nunca sai do servidor)
  ✓  Reset de senha por e-mail com token de uso único e expiração
  ✓  Geofencing por funcionário (Haversine, validação no servidor — não confia no cliente)
  ✓  Sessões revogáveis via sessions_valid_from no JWT payload
  ✓  Monitorização Sentry — erros capturados sem expor segredos
```

<br/>

---

## ◈ roadmap

```
  ✓  Trocar senha dentro do sistema
  ✓  Horas extras calculadas automaticamente
  ✓  Notificações push de fim de jornada e hora extra (PWA)
  ✓  Histórico e relatórios por período
  ✓  Ganhos do dia em tempo real (EUR)
  ✓  PWA — ícone na tela inicial do celular
  ✓  Layout responsivo mobile + desktop (iOS Safari incluído)
  ✓  Admin registra ponto por funcionário
  ✓  Papel "gerente" (acesso intermediário)
  ✓  Pausas explícitas: Almoço / Pausa Café / Retorno
  ✓  Ganhos por funcionário no painel de status
  ✓  CSV profissional (resumo diário com pausas e ganhos)
  ✓  Admin altera nome de usuário dos funcionários
  ✓  Alerta de funcionários sem saída registrada
  ✓  Dashboard com gráficos de horas por dia e mês
  ✓  Audit log de alterações administrativas
  ✓  Redesign admin Linear/Notion/VSCode — sidebar agrupada colapsável, topbar com breadcrumbs
  ✓  Command Palette ⌘K — navegação por teclado + ações rápidas (novo func., exportar, tema)
  ✓  Settings Modal centralizado (tema, idioma, palavra-passe, sair)
  ✓  Notifications Dropdown no sino — correções pendentes, saídas em falta, ausências
  ✓  Dashboard redesenhado — KPIs, sparkline, gráfico 14 dias, feed de batidas, próximos eventos
  ✓  Dashboard "Atenção" — funcionários atrasados (vs expected_start) + ausentes do dia
  ✓  Status detecta sessões abertas de dias anteriores (entrada de ontem sem saída → "Trabalhando")
  ✓  Status com toggle Lista/Cards (vista grid responsiva)
  ✓  Registros com search por nome, filtro por tipo, range pills (7d/14d/30d) e agrupamento por data
  ✓  Funcionários com filter bar (search/cargo/ativos) e tabela densa com drawer de edição
  ✓  Banco de horas com KPI grid (Total/Positivos/Negativos/Zerados) + tabela com trend bars
  ✓  Relatórios com KPI summary (Total/Extras/Custo/Médio), quick range pills (Mês atual/passado/30d/Tri) e tabela por funcionário (Resumo/Detalhado + Holerite)
  ✓  Feriados com vista Calendário (grelha mensal navegável com células coloridas)
  ✓  Auditoria com search, filtro de ator e exportar JSON
  ✓  Page-head consistente em todos os 10 tabs (título, contagem, ações)
  ✓  Banco de horas com ajustes manuais
  ✓  Solicitações de correção de registo (funcionário solicita, admin aprova)
  ✓  Feriados e dias de folga (global e por funcionário)
  ✓  Geolocalização por registo (configurável por funcionário)
  ✓  Geofencing por funcionário (raio em metros, validação Haversine no servidor)
  ✓  Modo quiosque (tablet partilhado, sem login individual)
  ✓  i18n — PT-PT / PT-BR / EN / ES
  ✓  Reset de senha por e-mail
  ✓  Tema claro/escuro persistido no banco por funcionário
  ✓  Lock de perfil por funcionário
  ✓  Exportação PDF (relatório A4 com cabeçalho, tabelas por funcionário e totais)
  ✓  Notificação push de ausência (cron 09:00 UTC dias úteis, protegido por CRON_SECRET)
  ✓  Alerta de saída não registada (cron 17:00 UTC, push aos admins)
  ✓  Vista calendário mensal no histórico do funcionário (cores por estado do dia)
  ✓  Turno noturno (shift_start hora local — entrada 22h creditada no dia anterior)
  ✓  Horas flexíveis (expected_start / expected_end por funcionário)
  ✓  Comentário em registo (nota livre do admin/gerente, ≤ 500 chars)
  ✓  Aviso de shift_start incomum (alerta amarelo ao configurar turno diurno com horário > 00:00)
  ✓  E-mail via Microsoft Graph API (OAuth Client Credentials) com fallback SMTP automático
  ✓  Testes Vitest (utils, auth, rateLimit)
  ✓  Monitorização Sentry (cliente + servidor, source maps)
  ☐  Domínio personalizado por empresa                     → issue #5
  ☐  Multi-empresa (tenancy)                               → issue #6
  ✓  Relatório mensal automático por e-mail (cron + disparo manual)
  ☐  App móvel nativa (Capacitor ou Expo)                  → issue #58
```

<br/>

---

## ◈ documentação técnica

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — diagrama Mermaid + fluxo de auth + ciclo de ponto + API surface + schema
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — referência humana das tabelas (colunas, tipos, FKs, índices)
- [`docs/SECURITY.md`](docs/SECURITY.md) — JWT + cookies + bcrypt + rate limit + revogação + geofencing
- [`supabase/schema.sql`](supabase/schema.sql) — schema completo + migrações v1→v10
- [`.env.example`](.env.example) — todas as variáveis com comentários e instruções

<br/>

---

## ◈ licença

MIT — faça o que quiser, mas lembre de onde veio.

<br/>

---

<div align="center">

```
         ╭──────────────────────────────────────────╮
         │                                          │
         │   feito com  ♥  e  CSS variables          │
         │                                          │
         │   a estrutura não mente.                 │
         │   o tempo não volta.                     │
         │   o ponto, agora, é seu.                 │
         │                                          │
         ╰──────────────────────────────────────────╯
```

*[ponto-glass-next.vercel.app](https://ponto-glass-next.vercel.app)*

</div>
