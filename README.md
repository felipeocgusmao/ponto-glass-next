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
│   Estilo      →   Tailwind CSS + Liquid Glass custom    │
│   Auth        →   JWT em httpOnly cookie  (8 horas)     │
│   Banco       →   Supabase  (PostgreSQL gerenciado)     │
│   Senhas      →   bcryptjs  (hash + salt)               │
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
| **Liquid Glass CSS** | Porque interfaces podem ser bonitas e funcionais ao mesmo tempo |

<br/>

---

## ◈ funcionalidades

```
  FUNCIONÁRIO                          GERENTE                              ADMINISTRADOR
  ───────────                          ───────                              ─────────────
  ● Relógio ao vivo                    ● Dashboard mensal (gráfico + metas) ● Tudo do Gerente
  ● Status: dentro / pausa / fora      ● Painel de status ao vivo           ● Cadastrar e remover funcionários
  ● Registrar entrada / saída          ● Ver quem está em serviço agora     ● Configurar jornada (4–10h)
  ● Pausas: Almoço / Café / Retorno    ● Ver ganhos de cada funcionário     ● Configurar desconto de almoço
  ● Horas trabalhadas ao vivo (30s)    ● Registrar ponto por funcionário    ● Definir valor/hora em €
  ● Ganhos do dia em tempo real        ● Histórico de registros             ● Redefinir senha de qualquer usuário
  ● Desconto de almoço automático*     ● Banco de horas — saldos e ajustes  ● Alterar nome de usuário e email
  ● Banco de horas acumulado           ● Feriados e folgas justificadas     ● Criar usuários (funcionário/gerente/admin)
  ● Horas extras acumuladas            ● Relatórios por período             ● Geolocalização por funcionário
  ● Notificações de fim de jornada     ● Exportar CSV profissional          ● Audit log de todas as ações
  ● Geolocalização no registo          ● Exportar recibo PDF por pessoa     ● Dashboard com gráfico mensal
  ● Troca de senha
  ● Histórico do dia
```

*\*desconto automático só se aplica quando pausas explícitas não foram registradas (fallback legado)*

**Auto-seed:** no primeiro login, o sistema cria o usuário `admin` automaticamente.  
Nenhuma configuração manual de banco necessária.

**Recuperação de emergência:** rota `/api/auth/recover` com `RECOVERY_SECRET` para quando o admin perde o acesso.

<br/>

---

## ◈ design — liquid glass

O visual foi construído do zero em CSS puro — sem bibliotecas de UI, sem componentes prontos.

```css
/* a essência do glass */
.glass {
  background    : rgba(255, 255, 255, 0.04);
  backdrop-filter : blur(24px) saturate(160%);
  border        : 1px solid rgba(255, 255, 255, 0.10);
  box-shadow    : 0 8px 32px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
```

A ideia: o vidro deixa passar a luz, mas não desaparece.  
A interface existe sem gritar. Está lá — elegante, funcional, presente.

<br/>

---

## ◈ arquitetura

```
ponto_glass_next/
│
├── app/
│   ├── page.tsx              ← redirect inteligente (admin/manager → /admin | employee → /ponto)
│   ├── login/page.tsx        ← autenticação
│   ├── ponto/page.tsx        ← painel do funcionário
│   ├── admin/page.tsx        ← painel admin/gerente (tabs filtradas por role)
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/        ← bcrypt + JWT + cookie + rate limit
│       │   ├── logout/       ← limpa cookie
│       │   └── recover/      ← reset de emergência via RECOVERY_SECRET
│       ├── me/               ← perfil completo do usuário logado
│       ├── punch/            ← registra ponto com geolocalização opcional
│       ├── records/          ← lista e edita registros (filtros por data / funcionário)
│       │   └── [id]/         ← PATCH (editar) / DELETE (remover)
│       ├── employees/        ← CRUD funcionários (email, jornada, geo, valor/hora)
│       │   └── [id]/         ← PATCH / DELETE (soft delete)
│       ├── reports/          ← relatório por período (máx 366 dias / 2000 registros)
│       ├── hour-bank/        ← saldo e ajustes manuais do banco de horas
│       │   └── [id]/         ← DELETE ajuste
│       ├── day-exceptions/   ← feriados e folgas justificadas
│       │   └── [id]/         ← DELETE exceção
│       └── audit/            ← audit log de ações administrativas (admin only)
│
├── components/
│   ├── PunchCard.tsx         ← card de ponto com métricas ao vivo, geo e banco de horas
│   ├── LiveClock.tsx         ← relógio em tempo real
│   └── ChangePasswordModal.tsx
│
├── lib/
│   ├── auth.ts               ← createJWT / verifyJWT
│   ├── supabase.ts           ← cliente Supabase (service_role)
│   ├── audit.ts              ← logAudit() fire-and-forget
│   ├── rateLimit.ts          ← rate limiter em memória (login / recover)
│   ├── types.ts              ← Employee, EmployeeProfile, PunchRecord, AuditLog, DayException…
│   └── utils.ts              ← calcHours, calcNetMinutes, calcTimeBreakdown, fmtMinutes…
│
├── public/
│   ├── manifest.json         ← PWA manifest
│   └── sw.js                 ← Service Worker (cache offline)
│
├── middleware.ts              ← RBAC: protege rotas por role (admin/manager/employee)
└── supabase/schema.sql        ← schema completo + migrações v1→v6
```

<br/>

---

## ◈ como rodar localmente

**1. Clone**
```bash
git clone https://github.com/felipeocgusmao/ponto-glass-next.git
cd ponto-glass-next
```

**2. Instale as dependências**
```bash
npm install
```

**3. Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
JWT_SECRET=sua-chave-secreta-minimo-32-caracteres
RECOVERY_SECRET=chave-de-recuperacao-de-emergencia
```

**4. Crie o banco**

Execute `supabase/schema.sql` no SQL Editor do seu projeto Supabase.

> **Banco já existente?** O arquivo inclui blocos de migração incremental v1→v6 — execute apenas os blocos correspondentes à versão que você já tem.

**5. Rode**
```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).  
Login: `admin` / `admin123` — **troque a senha no primeiro acesso.**

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
  email               TEXT,           ← opcional
  password_hash       TEXT,           ← bcrypt, nunca texto puro
  role                TEXT,           ← 'admin' | 'manager' | 'employee'
  active              BOOLEAN,        ← soft delete
  workday_hours       DECIMAL(4,2),   ← jornada configurável (padrão 8h)
  lunch_break_minutes INT,            ← desconto de almoço (padrão 60min)
  hourly_rate         DECIMAL(10,2),  ← valor/hora em € (opcional)
  geo_mode            TEXT,           ← 'required' | 'optional' | 'disabled'
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
  date          DATE,              ← índice de busca por dia
  latitude      DECIMAL(9,6),     ← geolocalização opcional
  longitude     DECIMAL(9,6)
)

-- ajustes manuais do banco de horas
hour_bank_adjustments (
  id          UUID  PRIMARY KEY,
  employee_id UUID  → employees.id,
  minutes     INT,                 ← positivo = crédito, negativo = débito
  reason      TEXT,
  date        DATE,
  created_by  UUID  → employees.id,
  created_at  TIMESTAMPTZ
)

-- feriados e folgas justificadas
day_exceptions (
  id          UUID  PRIMARY KEY,
  date        DATE,
  type        TEXT,                ← 'holiday' | 'day_off'
  description TEXT,
  employee_id UUID  → employees.id ← null = aplica a todos
  created_by  UUID  → employees.id,
  created_at  TIMESTAMPTZ
)

-- audit log
audit_logs (
  id          UUID  PRIMARY KEY,
  actor_id    UUID  → employees.id,
  actor_name  TEXT,
  action      TEXT,                ← 'employee_create' | 'punch_on_behalf' | …
  target_id   UUID,
  target_name TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ
)
```

> O arquivo `supabase/schema.sql` inclui os scripts de migração incremental **v1 → v6**.

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
  ✓  Row Level Security habilitado no Supabase (todas as tabelas)
  ✓  Funcionários só enxergam os próprios registros
  ✓  Soft delete — nenhum dado é apagado permanentemente
  ✓  Proteção ao último administrador (não pode ser removido)
  ✓  Recuperação de emergência via RECOVERY_SECRET
  ✓  Audit log completo de todas as ações administrativas
```

<br/>

---

## ◈ roadmap

```
  ✓  Trocar senha dentro do sistema
  ✓  Horas extras calculadas automaticamente
  ✓  Notificações de fim de jornada e hora extra
  ✓  Histórico e relatórios por período
  ✓  Ganhos do dia em tempo real (EUR)
  ✓  PWA — ícone na tela inicial do celular (manifest + service worker)
  ✓  Layout responsivo mobile + desktop
  ✓  Admin registra ponto por funcionário
  ✓  Papel "gerente" (acesso intermediário)
  ✓  Pausas explícitas: Almoço / Pausa Café / Retorno
  ✓  Ganhos por funcionário no painel de status
  ✓  CSV profissional (resumo diário com pausas e ganhos)
  ✓  Admin altera nome de usuário dos funcionários
  ✓  Dashboard com gráfico mensal de horas e metas por funcionário
  ✓  Audit log completo de todas as ações administrativas
  ✓  Banco de horas — saldo acumulado + ajustes manuais
  ✓  Geolocalização no registo de ponto (opcional / obrigatória / desativada)
  ✓  Campo email por funcionário
  ✓  Feriados e folgas justificadas
  ✓  Recibo PDF por funcionário
  ✓  Alertas de dias sem saída registrada
  ☐  Relatório mensal automático por e-mail                → issue #9
  ☐  Domínio personalizado                                 → issue #5
  ☐  Multi-empresa (tenancy)                               → issue #6
```

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
         │   feito com  ♥  e  backdropFilter blur   │
         │                                          │
         │   o vidro não mente.                     │
         │   o tempo não volta.                     │
         │   o ponto, agora, é seu.                 │
         │                                          │
         ╰──────────────────────────────────────────╯
```

*[ponto-glass-next.vercel.app](https://ponto-glass-next.vercel.app)*

</div>
