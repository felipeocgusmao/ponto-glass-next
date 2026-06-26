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
│   Cron        →   Vercel Cron Jobs  (ausência, saída, mensal, semanal, alertas, bank-cap)│
│   Voz         →   Web Speech API  (reconhecimento + TTS)│
│   Testes      →   Vitest  (147 unit) + Playwright  (E2E) │
│   Monitor     →   Sentry  (erros cliente + servidor)    │
│   Geofencing  →   Haversine  (raio por funcionário)     │
│   Horas       →   Centesimal  (base 100, quarto de hora)│
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
| **Vitest** | 147 testes unitários: horas, auth, rate limit, geofencing, de-dup, voz, tenancy, TOTP e importação |
| **Playwright** | Testes E2E do fluxo principal (landing, auth, demo, SEO) |
| **Web Speech API** | Reconhecimento de voz (SpeechRecognition) + síntese de fala (TTS) no `/kiosk/glass` |
| **Sentry** | Captura de erros e source maps automáticos via `withSentryConfig` |
| **Haversine** | Cálculo de distância para validação opcional de geofencing por funcionário |
| **Horas centesimais** | Relatórios em base 100 (`7,75` = 7h45) com arredondamento ao quarto de hora |

<br/>

---

## ◈ quickstart

> Tempo estimado: 10–15 minutos para ter o ambiente local a correr.

### Requisitos

- Node.js 20+ e npm
- Conta [Supabase](https://supabase.com) (gratuita serve)
- (Opcional) Conta [Vercel](https://vercel.com) para deploy

### 1. Clonar e instalar

```bash
git clone https://github.com/felipeocgusmao/ponto-glass-next.git
cd ponto-glass-next
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` e preencha **no mínimo** as variáveis obrigatórias:

| Variável | Obrigatória | Onde encontrar |
|----------|:-----------:|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Project Settings → API |
| `JWT_SECRET` | ✅ | `openssl rand -base64 32` |
| `NEXT_PUBLIC_BUSINESS_TZ` | ✅ | Ex: `Europe/Lisbon`, `America/Sao_Paulo` |
| `INITIAL_ADMIN_PASSWORD` | ✅ (1ª vez) | Qualquer senha ≥ 8 caracteres |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ⚠️ Prod | Vercel KV ou Upstash Redis |
| `CRON_SECRET` | ⚠️ Prod | `openssl rand -base64 32` |
| `RECOVERY_SECRET` | Recomendado | `openssl rand -base64 32` |

> Ver [`.env.example`](.env.example) para todas as variáveis com comentários detalhados.

### 3. Base de dados (Supabase)

No painel Supabase, vá a **SQL Editor** e execute o schema completo:

```bash
# Conteúdo do ficheiro:
cat supabase/schema.sql
```

Cole e execute no SQL Editor do Supabase. O schema cria todas as tabelas, índices e activa RLS.

> **Migrações incrementais:** se já tem uma instalação anterior, os ficheiros em `supabase/migrations/` contêm os deltas numerados. Execute na ordem do nome do ficheiro.

### 4. Primeiro arranque e admin inicial

```bash
npm run dev
```

Aceda a `http://localhost:3000`. Com `INITIAL_ADMIN_PASSWORD` definido e a base vazia, o sistema cria automaticamente o utilizador `admin` na primeira chamada à API.

Faça login com:
- **Utilizador:** o valor de `INITIAL_ADMIN_USERNAME` (default: `admin`)
- **Senha:** o valor de `INITIAL_ADMIN_PASSWORD`

> ⚠️ **Depois do primeiro login**, remova `INITIAL_ADMIN_PASSWORD` do ambiente (ou deixe-o em branco). Troque a senha dentro do sistema e configure o e-mail do admin em Funcionários → Editar.

### 5. Comandos úteis

```bash
npm run dev        # servidor de desenvolvimento (http://localhost:3000)
npm run build      # build de produção
npm run test       # testes unitários (Vitest)
npm run test:e2e   # testes E2E (Playwright) — requer servidor em execução
npm run lint       # ESLint
```

### 6. Deploy na Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Ou ligue o repositório em [vercel.com/new](https://vercel.com/new) e configure as variáveis de ambiente em **Project → Settings → Environment Variables** (copie de `.env.example`).

> **Crons:** adicione as entradas em `vercel.json` → `"crons"` e defina `CRON_SECRET`. Os endpoints ficam em `/api/cron/*`.

---

### Serviços opcionais

<details>
<summary><strong>Push Notifications (VAPID)</strong></summary>

```bash
# Gerar par de chaves VAPID
node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys(), null, 2))"
```

Copie `publicKey` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `privateKey` → `VAPID_PRIVATE_KEY`.  
Defina `VAPID_EMAIL=mailto:admin@suaempresa.com`.

</details>

<details>
<summary><strong>E-mail (SMTP / Microsoft Graph)</strong></summary>

**SMTP (Gmail):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seuemail@gmail.com
SMTP_PASS=<app password>   # myaccount.google.com → Segurança → App passwords
SMTP_FROM=PontoGlass <noreply@suaempresa.com>
NEXT_PUBLIC_APP_URL=https://ponto-glass-next.vercel.app
```

**Microsoft Graph (sem licença por caixa):**  
Azure AD → App Registrations → permissão `Mail.Send` → Client Credentials.  
Preencha `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_SENDER_EMAIL`.  
Quando as 4 variáveis MS estão presentes, o Graph tem prioridade sobre SMTP.

</details>

<details>
<summary><strong>Rate Limiting distribuído (obrigatório em produção)</strong></summary>

Sem KV/Redis, o rate limit é **por instância**. Em produção no Vercel (multi-instância) isso não protege.

**Vercel KV:** Dashboard → Storage → KV → Create → a integração define `KV_REST_API_URL` e `KV_REST_API_TOKEN` automaticamente.

**Upstash Redis:** [upstash.com](https://upstash.com) → Create Database → copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

</details>

<details>
<summary><strong>Sentry</strong></summary>

1. Crie projeto em [sentry.io](https://sentry.io)
2. Copie o DSN → `NEXT_PUBLIC_SENTRY_DSN`
3. Para source maps em CI: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

</details>

---

### Troubleshooting

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| Login recusa sempre | `JWT_SECRET` ausente ou diferente entre instâncias | Defina uma string fixa ≥ 32 chars |
| "Unauthorized" depois de login | Cookie `httpOnly` bloqueado (HTTP em dev) | Use `https://` ou `localhost` |
| Admin não criado no 1º arranque | `INITIAL_ADMIN_PASSWORD` não estava definido quando a base foi criada | Defina a variável e apague a tabela `employees` para re-seed |
| Notificações push não chegam | VAPID mal configurado | Verifique se `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` formam um par gerado juntos |
| E-mail não enviado | SMTP/Graph sem credenciais | Verifique `SMTP_HOST`+`SMTP_PASS` ou as 4 vars `MS_*` |
| Rate limit bypass em produção | Sem KV/Redis | Configure `KV_REST_API_URL`+`TOKEN` (Vercel KV) ou Upstash |
| Cron não dispara | `CRON_SECRET` ausente ou endpoint inacessível | Confirme a variável e teste `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/absence-check` |
| Erro de CORS / tenant errado | `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` mal configurado | Deixe em branco para single-tenant; ver `docs/TENANTS.md` para multi-tenant |
| Build falha no Vercel | Variável de ambiente ausente | Confirme todas as vars obrigatórias em Project Settings → Environment Variables |

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
  ● Solicitar correção de registo      ● Exportar ICS (calendário)          ● Gerir solicitações de correção
  ● Notificações push de fim jornada   ● Gerir feriados e folgas            ● Configurar geo por funcionário
  ● Push server-side ao cumprir horas  ● Aprovar/rejeitar correções         ● Bloquear perfil de funcionário
  ● Histórico mensal (lista)           ● Dashboard com gráficos             ● Ajustar banco de horas manualmente
  ● Vista calendário mensal            ● Alerta de saídas em falta          ● Definir horário esperado por func.
  ● Trocar senha                       ● Quiosque de ponto                  ● Comentário em qualquer registo
  ● Terminar outras sessões            ● Push de ausência (cron 09h UTC)    ● Relatório semanal automático por e-mail
  ● Selector de idioma (PT/BR/EN/ES)   ● Comentários em registos            ● Monitorização via /api/health
  ● Tema claro/escuro (persiste)       ● Paginação automática em relatórios ● Alertas configuráveis (banco/jornada)
  ● Dashboard pessoal (gráfico 7d)     ● Relatório de pontualidade          ● Webhooks de saída (HMAC assinados)
  ● 9 cores de destaque               ● Relatório de ausências             ● Integrações (Zapier, Make, ERPs)
  ● 3 variantes de fonte              ● QR code por funcionário no quiosque● Templates de turno reutilizáveis
  ● Histórico de sessões (revoke)     ● Aprovação de semana por funcionário● Limite de banco de horas (cap + cron)
                                       ● Foto no quiosque (webcam JPEG)     ● Auto saída por geofencing (5 min)
```

*\*desconto automático só se aplica quando pausas explícitas não foram registradas (fallback legado)*

**Auto-seed:** no primeiro login, o sistema cria o usuário `admin` automaticamente.  
Nenhuma configuração manual de banco necessária.

**Recuperação de emergência:** rota `/api/auth/recover` com `RECOVERY_SECRET` para quando o admin perde o acesso.

**Modo Quiosque:** página `/kiosk` para tablet/ecrã compartilhado — qualquer funcionário bate o ponto sem fazer login individual. O admin pode gerar um **QR code HMAC** por funcionário (botão "QR" em cada tile); o funcionário escaneia com o próprio telemóvel e abre `/kiosk/confirm` — página pública que valida o token e regista a batida sem exigir login. O token é derivado de HMAC-SHA256(`empId:tenantId`) e nunca expira, mas pode ser invalidado trocando `QR_SECRET`. Variante `/kiosk/glass` otimizada para **smart glasses Android** (640×400 landscape, alto contraste, navegação por D-pad/teclado, batida com contagem regressiva de 3s cancelável). Suporta **comandos de voz** via Web Speech API: pressione **M** (ou toque 🎙) e diga *"Maria entrada"* — o sistema seleciona a pessoa, bate o ponto e confirma com TTS em PT-PT. Funciona com nomes parciais, sem acentos, e reconhece sinónimos (`"almoço"`, `"pausa"`, `"voltei do almoço"`, `"cancelar"`). Gracioso em Firefox (botão some se a API não existir).

**Horas centesimais:** relatórios, holerites, CSV, banco de horas e ganhos exibem o tempo em **base 100** — `7h45m → 7,75`. Cada dia é arredondado ao **quarto de hora mais próximo** (`:00 / :15 / :30 / :45`), então o total na tela sempre bate com a soma das linhas. O cronómetro ao vivo do `/ponto` continua exato em tempo real.

**Lembrete de entrada pelo servidor:** rota protegida por `CRON_SECRET`, acionada por GitHub Actions a cada ~5 min em dias úteis (`APP_URL` + `CRON_SECRET`), encontra funcionários com `expected_start` na próxima hora, ainda sem `entrada`, e envia Web Push via VAPID mesmo se `/ponto` não estiver aberto. A agenda fica fora do `vercel.json` para não quebrar deploys no Vercel Hobby.

**Lembrete de quarto de hora:** notificação push ~2 min antes de cada marca de 15 min, para a pessoa bater entrada/saída "no horário certinho". Entrada a partir do `expected_start` (ou 08:00); saída a partir do `expected_end` (ou jornada cumprida). Almoço e pausa-café ficam de fora.

**Modo offline:** quando o dispositivo está sem rede, a batida é guardada no `localStorage` e sincronizada automaticamente ao reconectar (com Background Sync no Service Worker e indicador visual de pendências).

**Página de demonstração:** `/demo` lista credenciais fictícias (admin / gerente / funcionário) com dados de exemplo, para avaliação rápida sem precisar criar conta. Marcada como `noindex`.

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

**Admin shell** — sidebar agrupada (OPERAÇÃO / PESSOAS / ANÁLISE), botão de colapsar com persistência em `localStorage`, topbar com breadcrumbs, busca **⌘K** que abre uma **Command Palette** (navegação + ações), **Notifications Dropdown** no sino (correções pendentes, saídas em falta, ausências) e um **Settings Modal** centralizado com glassmorphism: tema claro/escuro, 9 cores de destaque em swatches, 3 variantes de fonte (Inter / JetBrains Mono / Lora serif), idioma, segurança (2FA + histórico de sessões com revoke) e logout.

**Page-head** consistente em todos os tabs: título, subtítulo dinâmico (contagem ou estado) e botões de ação (Atualizar, Exportar, etc.).

**Employee shell** — ecrã `/ponto` em layout fullscreen com relógio ao vivo, anel de progresso, ações contextuais (entrada / almoço / pausa / saída) e navegação inferior por 5 tabs (Ponto, Histórico, Banco, Correções, Perfil).

Tema claro/escuro, 9 cores de destaque e 3 variantes de fonte persistem via `localStorage` (restauradas sem FOUC pelo inline script no `<head>`). Modais, drawers e command palette usam `backdrop-filter: blur` para efeito glassmorphism.  
Tema claro/escuro também persiste no banco por funcionário.  
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
│   ├── _components/
│   │   └── ErrorBoundary.tsx     ← React class component — captura erros de rendering por tab
│   ├── page.tsx                  ← redirect inteligente (admin/manager → /admin | employee → /ponto)
│   ├── login/page.tsx            ← autenticação (split-screen com relógio animado)
│   ├── reset-password/page.tsx   ← reset de senha via link de e-mail
│   ├── ponto/page.tsx            ← shell fullscreen do funcionário (relógio, histórico, banco, correções)
│   │   └── _components/
│   │       └── CalendarView      ← grelha de mês com dias coloridos (trabalhado/ausente/feriado)
│   ├── demo/page.tsx             ← página pública de credenciais demo (noindex)
│   ├── kiosk/page.tsx            ← modo quiosque (tablet compartilhado, sem login individual)
│   │   └── glass/page.tsx        ← variante para smart glasses Android (640×400, alto contraste)
│   ├── admin/page.tsx            ← painel admin/gerente (sidebar agrupada, 10 abas por role)
│   │   ├── _lib/
│   │   │   └── useNotifications  ← hook que agrega correções pendentes, saídas em falta, ausências
│   │   └── _components/
│   │       ├── Sidebar           ← grupos OPERAÇÃO / PESSOAS / ANÁLISE, colapsável, drawer mobile
│   │       ├── TopBar            ← breadcrumbs + ⌘K + tema + sino com badge
│   │       ├── CommandPalette    ← navegação por teclado e ações rápidas (⌘K / Ctrl+K)
│   │       ├── NotificationsDropdown  ← popover do sino: correções, saídas em falta, ausências
│   │       ├── SettingsModal     ← glassmorphism; tema, 9 accents, 3 fontes, idioma, sessões, sair
│   │       └── tabs/
│   │           ├── MeuPontoTab       ← ponto do admin/gerente logado
│   │           ├── DashboardTab      ← KPIs, sparkline, gráfico 14 dias, feed de batidas, atrasos
│   │           ├── StatusTab         ← status ao vivo, toggle Lista/Cards, detecta sessões abertas de ontem
│   │           ├── RegistrosTab      ← search + tipo + range pills (Hoje/7d/14d/30d), agrupado por data
│   │           ├── FuncionariosTab   ← filter bar + tabela densa + drawer de configurações
│   │           ├── BancoHorasTab     ← KPI grid, tabela com trend bars centradas em zero
│   │           ├── FeriadosTab       ← toggle Lista/Calendário (grelha mensal navegável)
│   │           ├── RelatoriosTab     ← KPI summary, quick range pills, tabela por funcionário (Resumo/Detalhado), exportação ICS, paginação automática
│   │           ├── CorrecoesTab      ← aprovar/rejeitar solicitações de correção
│   │           ├── AuditoriaTab      ← search + filtro de ator + exportar JSON
│   │           ├── AlertasTab        ← thresholds de banco de horas negativo e jornada longa
│   │           └── IntegracoesTab    ← gestão de webhooks de saída (HMAC, toggle, remover)
│   │
│   └── api/
│       ├── health/               ← endpoint público de saúde (sem auth, retorna status DB)
│       ├── auth/
│       │   ├── login/            ← bcrypt + JWT + cookie + rate limit (IP + por utilizador)
│       │   ├── logout/           ← limpa cookie
│       │   ├── password/         ← troca de senha autenticada
│       │   ├── forgot-password/  ← envia link de reset por e-mail
│       │   ├── reset-password/   ← valida token e redefine senha
│       │   ├── recover/          ← reset de emergência via RECOVERY_SECRET
│       │   └── revoke-other-sessions/ ← revoga sessões anteriores + emite novo token
│       ├── me/                   ← perfil completo + PATCH (tema, e-mail, geo_mode)
│       ├── punch/                ← registra ponto + push quando jornada concluída
│       ├── records/              ← lista / edita / remove registros + comentários
│       │   └── [id]/
│       ├── employees/            ← CRUD funcionários + horário esperado + turno noturno
│       │   └── [id]/
│       ├── cron/
│       │   ├── entry-reminder/   ← push de entrada previsto na próxima hora (CRON_SECRET)
│       │   ├── absence-check/    ← push de ausência (protegido por CRON_SECRET)
│       │   ├── missing-exit/     ← alerta de saída não registada às 17h (protegido por CRON_SECRET)
│       │   ├── monthly-report/   ← relatório mensal por e-mail com tabela diária (1º do mês, 08h UTC)
│       │   ├── weekly-report/    ← relatório semanal por e-mail (2ª-feira, 08h UTC)
│       │   ├── alert-check/      ← alertas configuráveis: banco negativo + jornada longa (seg-sex 18h UTC)
│       │   └── hour-bank-cap/    ← capa saldo positivo ao limite configurado (1º do mês, 08h UTC)
│       ├── hour-bank/            ← saldo do banco de horas + ajustes manuais
│       │   └── [id]/
│       ├── correction-requests/  ← criar / listar / aprovar / rejeitar correções
│       │   └── [id]/
│       ├── day-exceptions/       ← feriados e dias de folga (global ou por funcionário)
│       │   └── [id]/
│       ├── push-subscribe/       ← regista subscription VAPID do browser
│       ├── audit/                ← audit log (admin only)
│       ├── qr/                   ← gera QR code HMAC por funcionário (data URL)
│       │   └── punch/            ← endpoint público: valida token HMAC e insere batida
│       ├── tenant-settings/      ← lê/escreve alert_settings (thresholds + hour_bank_max_positive)
│       ├── timesheet-approvals/  ← aprovação/revogação de semana por funcionário
│       ├── webhook-configs/      ← CRUD de webhooks de saída (URL, segredo, toggle)
│       ├── shift-templates/      ← CRUD de templates de turno
│       │   └── apply/            ← aplica template a lista de funcionários
│       ├── login-sessions/       ← histórico de sessões (GET últimas 20, DELETE revoke)
│       ├── kiosk-photos/         ← armazena/recupera foto capturada no quiosque
│       └── reports/              ← relatório por período (máx 366 dias, paginação automática)
│           ├── calendar/         ← exportar registros como .ics (iCalendar, 1 VEVENT/dia)
│           ├── punctuality/      ← estatísticas de pontualidade por funcionário (on-time/atrasado)
│           └── absences/         ← dias ausentes por funcionário no mês
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
│   ├── punchQueue.ts         ← fila offline de batidas (localStorage + flush ao reconectar)
│   ├── punchValidation.ts    ← validateGeofence, isDuplicatePunch, isValidPunchType (puras + testáveis)
│   ├── voice.ts              ← parseVoiceCommand, getSpeechRecognition, speak (TTS)
│   └── utils.ts              ← calcHours, calcNetMinutes, calcEarnings, fmtCentesimal, roundToQuarter…
│
├── middleware.ts              ← RBAC: protege rotas por role (admin/manager/employee)
├── public/sw.js               ← Service Worker (cache + push + Background Sync da fila offline)
├── vercel.json                ← Vercel Cron Jobs (absence-check 09:00 + missing-exit 17:00 UTC)
├── sentry.client.config.ts    ← inicialização Sentry no cliente
├── sentry.server.config.ts    ← inicialização Sentry no servidor
├── vitest.config.ts           ← configuração Vitest (jsdom, exclui e2e/)
├── playwright.config.ts        ← configuração Playwright (E2E, Chromium)
├── __tests__/                 ← 147 testes unitários (utils, auth, tenancy, totp, employeeImport, punchQueue…)
├── e2e/                       ← testes E2E (landing, auth, demo, SEO)
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
npm run e2e          # Playwright (E2E)
npm run e2e:ui       # Playwright em modo UI
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

-- aprovações de semana (timesheet lock)
timesheet_approvals (
  id          UUID  PRIMARY KEY,
  tenant_id   UUID  → tenants.id,
  employee_id UUID  → employees.id,
  week_start  DATE,              ← segunda-feira da semana aprovada
  approved_by UUID,
  approved_at TIMESTAMPTZ
)

-- webhooks de saída
webhook_configs (
  id          UUID  PRIMARY KEY,
  tenant_id   UUID  → tenants.id,
  url         TEXT,              ← endpoint HTTPS de destino
  secret      TEXT,              ← chave HMAC-SHA256 (opcional)
  active      BOOLEAN,
  events      TEXT[],            ← ['punch']
  created_at  TIMESTAMPTZ
)

-- templates de turno
shift_templates (
  id                   UUID  PRIMARY KEY,
  tenant_id            UUID  → tenants.id,
  name                 TEXT,
  workday_hours        DECIMAL(4,2),
  lunch_break_minutes  INT,
  expected_start       TIME,
  expected_end         TIME,
  shift_start          TIME,
  created_at           TIMESTAMPTZ
)

-- sessões de login
login_sessions (
  id          UUID  PRIMARY KEY,
  employee_id UUID  → employees.id,
  tenant_id   UUID  → tenants.id,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ        ← NULL = ativa
)

-- fotos do quiosque
kiosk_photos (
  id          UUID  PRIMARY KEY,
  tenant_id   UUID  → tenants.id,
  record_id   UUID  → records.id,
  employee_id UUID  → employees.id,
  photo_data  TEXT,              ← data URL JPEG (≤ 300 KB)
  created_at  TIMESTAMPTZ
)

-- configurações de alertas (coluna JSON em tenants)
tenants.alert_settings JSONB → {
  hour_bank_low_threshold:  number | null,  ← minutos negativos
  long_day_threshold:       number | null,  ← minutos máximos/dia
  hour_bank_max_positive:   number | null   ← cap máximo de saldo positivo
}

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
  ✓  Rate limiting por IP: 5 tentativas / 15 min no login e na recuperação
  ✓  Rate limiting por utilizador: 10 tentativas / 30 min (lockout independente do IP)
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
  ✓  "Terminar outras sessões" — revoga tokens anteriores, emite sessão fresca
  ✓  React Error Boundary em todos os tabs — falhas de rendering não quebram o shell
  ✓  Monitorização Sentry — erros capturados sem expor segredos
  ✓  QR kiosk com token HMAC-SHA256 (empId:tenantId) — batida sem login, sem cookie
  ✓  Webhooks assinados com X-PontoGlass-Signature: sha256={hex} (segredo opcional por endpoint)
  ✓  Timeout de 5s em entrega de webhooks — falhas silenciosas, não bloqueiam a batida
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
  ✓  Lembrete push de entrada pelo servidor (GitHub Actions a cada 5 min; expected_start na próxima hora)
  ✓  Notificação push de ausência (cron 09:00 UTC dias úteis, protegido por CRON_SECRET)
  ✓  Alerta de saída não registada (cron 17:00 UTC, push aos admins)
  ✓  Vista calendário mensal no histórico do funcionário (cores por estado do dia)
  ✓  Turno noturno (shift_start hora local — entrada 22h creditada no dia anterior)
  ✓  Horas flexíveis (expected_start / expected_end por funcionário)
  ✓  Comentário em registo (nota livre do admin/gerente, ≤ 500 chars)
  ✓  Aviso de shift_start incomum (alerta amarelo ao configurar turno diurno com horário > 00:00)
  ✓  E-mail via Microsoft Graph API (OAuth Client Credentials) com fallback SMTP automático
  ✓  Testes Vitest (147 unit: utils, auth, tenancy, TOTP, importação, fila offline…) + E2E Playwright
  ✓  Monitorização Sentry (cliente + servidor, source maps)
  ✓  Horas centesimais (base 100) com arredondamento ao quarto de hora em relatórios/banco/ganhos
  ✓  Lembrete push de quarto de hora (bater entrada/saída em :00/:15/:30/:45)
  ✓  Modo offline — fila de batidas no localStorage + Background Sync ao reconectar
  ✓  Modo Glass — /kiosk/glass para smart glasses Android (alto contraste, D-pad)
  ✓  Voz no Glass — Web Speech API: dizer "Maria entrada" seleciona + bate + confirma com TTS PT-PT
  ✓  Lógica de validação de punch extraída (punchValidation.ts) — geofencing, de-dup e tipos testáveis sem mock
  ✓  Página /demo com credenciais fictícias (noindex) + landing pública
  ✓  Acessibilidade — focus rings, aria-labels, skip-link, labels associados
  ✓  SEO — metadata Open Graph, OG image dinâmica, JSON-LD, robots.txt, sitemap.xml
  ✓  CI no GitHub Actions (lint + test + build) com badge
  ✓  Domínio personalizado por empresa (custom domain + slug subdomain)
  ✓  Multi-empresa (tenancy) — 5 fases: schema, API, RLS, host routing, super-admin
  ✓  Lixeira de funcionários — desativados ficam visíveis no filtro Inativos com Restaurar
  ✓  Importação CSV/XLSX de funcionários (preview com validação por linha, modelo para download)
  ✓  2FA TOTP opt-in (QR no perfil, código no login, reset por admin)
  ✓  Relatório mensal automático por e-mail com tabela diária (breakdown dia-a-dia no corpo do e-mail)
  ✓  React Error Boundary em todos os tabs do admin (recuperação sem refresh total)
  ✓  Endpoint /api/health para monitorização externa (sem autenticação)
  ✓  Bloqueio de conta por utilizador (10 tentativas / 30 min, independente do IP)
  ✓  "Terminar outras sessões" — revoga sessões anteriores, emite token fresco (admin + funcionário)
  ✓  Push server-side de jornada concluída (ao cruzar workday_hours na batida)
  ✓  Relatório semanal automático por e-mail (cron 2ª-feira 08h UTC)
  ✓  Exportação .ics (iCalendar) — um VEVENT por dia trabalhado, botão no RelatoriosTab
  ✓  UI otimista nos registos de ponto — estado visual muda antes da resposta do servidor
  ✓  Relatórios sem truncagem — paginação automática (todas as páginas em paralelo)
  ✓  Relatório de pontualidade — on-time vs atrasado por funcionário, com filtro por período e média de atraso
  ✓  Alertas configuráveis — thresholds de banco de horas negativo e jornada longa, cron seg-sex 18h UTC
  ✓  QR code por funcionário no quiosque — HMAC-SHA256, página /kiosk/confirm pública, sem login
  ✓  Aprovação de semana — admin aprova/revoga semana por funcionário no RegistrosTab
  ✓  Dashboard pessoal — gráfico SVG dos últimos 7 dias com linha-alvo no historico do /ponto
  ✓  Webhooks de saída — POST assinado para endpoints externos a cada batida (Zapier, Make, ERPs)
  ✓  Tab Integrações — gestão de webhooks com segredo HMAC, toggle ativo/pausado, remover
  ✓  Tab Alertas — configurar thresholds de push para admins (banco e jornada)
  ✓  Relatório de ausências — tabela por funcionário (dias ausentes no mês) no RelatoriosTab
  ✓  Templates de turno — criar templates reutilizáveis e aplicar a múltiplos funcionários de uma vez
  ✓  Histórico de sessões — últimas 20 sessões com IP e User-Agent, revogar individualmente em Configurações
  ✓  Limite de banco de horas — cap máximo de saldo positivo, cron mensal (1º do mês 08h UTC) que capa e notifica
  ✓  Auto punch-out geofencing — intervalo de 5 min em /ponto; saída automática se fora do raio 1,5×
  ✓  Foto no quiosque — captura webcam (canvas JPEG) no momento do punch; visualização em AuditoriaTab
  ✓  Glassmorphism — blur em todos os modais, painéis e command palette (backdrop-filter 6–24px)
  ✓  9 cores de destaque — Índigo, Violeta, Ciano, Verde, Teal, Âmbar, Laranja, Rosa, Cinza (persistidas)
  ✓  3 variantes de fonte — Linear (Inter), Workbench (JetBrains Mono), Editorial (Lora serif)
  ✓  Settings Modal redesenhado — grid responsivo, swatches de cor, seletor de fonte por card
  ☐  App móvel nativa (Capacitor ou Expo)                  → issue #58
```

<br/>

---

## ◈ documentação técnica

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — diagrama Mermaid + fluxo de auth + ciclo de ponto + API surface + schema
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — referência humana das tabelas (colunas, tipos, FKs, índices)
- [`docs/SECURITY.md`](docs/SECURITY.md) — JWT + cookies + bcrypt + rate limit + revogação + geofencing
- [`docs/TENANTS.md`](docs/TENANTS.md) — multi-tenancy: subdomínio por slug, domínio custom, DNS e fases
- [`supabase/schema.sql`](supabase/schema.sql) — schema completo + migrações v1→v13 (multi-tenancy fases 1 + 3)
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
