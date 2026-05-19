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
  FUNCIONÁRIO                          ADMINISTRADOR
  ───────────                          ─────────────
  ● Relógio ao vivo                    ● Painel de status em tempo real
  ● Status: dentro / fora              ● Ver quem está em serviço agora
  ● Registrar entrada / saída          ● Registrar ponto por qualquer funcionário
  ● Horas trabalhadas ao vivo (30s)    ● Cadastrar e remover funcionários
  ● Ganhos do dia em tempo real        ● Configurar jornada por funcionário (4–10h)
  ● Desconto de almoço automático      ● Configurar desconto de almoço (0–60min)
  ● Horas extras acumuladas            ● Definir valor/hora por funcionário
  ● Notificações de fim de jornada     ● Redefinir senha de qualquer funcionário
  ● Troca de senha                     ● Relatórios por período com exportação CSV
  ● Histórico do dia                   ● Layout responsivo (mobile + desktop)
```

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
│   ├── page.tsx              ← redirect inteligente (admin | ponto)
│   ├── login/page.tsx        ← autenticação
│   ├── ponto/page.tsx        ← painel do funcionário
│   ├── admin/page.tsx        ← painel admin (Status / Registros / Equipe / Relatório)
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/        ← bcrypt + JWT + cookie + rate limit
│       │   ├── logout/       ← limpa cookie
│       │   └── recover/      ← reset de emergência via RECOVERY_SECRET
│       ├── me/               ← perfil completo do usuário logado
│       ├── punch/            ← registra entrada/saída (admin pode registrar por outros)
│       ├── records/          ← lista registros (filtros por data / funcionário)
│       ├── employees/        ← CRUD funcionários + configurações individuais
│       │   └── [id]/         ← PATCH (jornada, almoço, valor/hora, senha) / DELETE
│       └── reports/          ← relatório por período (máx 366 dias / 2000 registros)
│
├── components/
│   ├── PunchCard.tsx         ← card de ponto com métricas ao vivo (30s)
│   ├── LiveClock.tsx         ← relógio em tempo real
│   └── ChangePasswordModal.tsx
│
├── lib/
│   ├── auth.ts               ← createJWT / verifyJWT
│   ├── supabase.ts           ← cliente Supabase (service_role)
│   ├── rateLimit.ts          ← rate limiter em memória (login / recover)
│   ├── types.ts              ← Employee, EmployeeProfile, PunchRecord, JWTUser
│   └── utils.ts              ← calcHours, calcNetMinutes, calcEarnings, fmtMinutes…
│
├── middleware.ts              ← RBAC: protege rotas por role
└── supabase/schema.sql        ← schema do banco com RLS habilitado
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
  password_hash       TEXT,           ← bcrypt, nunca texto puro
  role                TEXT,           ← 'admin' | 'employee'
  active              BOOLEAN,        ← soft delete
  workday_hours       DECIMAL(4,2),   ← jornada configurável (padrão 8h)
  lunch_break_minutes INT,            ← desconto de almoço (padrão 60min)
  hourly_rate         DECIMAL(10,2),  ← valor/hora em € (opcional)
  created_at          TIMESTAMPTZ
)

-- registros de ponto
records (
  id            UUID  PRIMARY KEY,
  employee_id   UUID  → employees.id,
  employee_name TEXT,           ← desnormalizado para relatórios
  type          TEXT,           ← 'entrada' | 'saída'
  timestamp     TIMESTAMPTZ,
  date          DATE            ← índice de busca por dia
)
```

RLS habilitado em ambas as tabelas — acesso via `service_role` apenas no servidor.

<br/>

---

## ◈ segurança

```
  ✓  Senhas com bcrypt (salt automático)
  ✓  JWT assinado com HS256 em httpOnly cookie (inatingível por JS)
  ✓  Middleware de RBAC em todas as rotas sensíveis
  ✓  Service role key nunca exposta ao cliente
  ✓  Rate limiting: 5 tentativas/15min no login e na recuperação
  ✓  Row Level Security habilitado no Supabase
  ✓  Funcionários só enxergam os próprios registros
  ✓  Soft delete — nenhum dado é apagado permanentemente
  ✓  Proteção ao último administrador (não pode ser removido)
  ✓  Recuperação de emergência via RECOVERY_SECRET
```

<br/>

---

## ◈ roadmap

```
  ✓  Trocar senha dentro do sistema
  ✓  Horas extras calculadas automaticamente
  ✓  Notificações de fim de jornada e hora extra
  ✓  Histórico e relatórios por período
  ✓  Ganhos do dia em tempo real
  ✓  PWA — ícone na tela inicial do celular
  ✓  Layout responsivo mobile + desktop
  ✓  Admin registra ponto por funcionário
  ☐  Papel "gerente" (acesso intermediário)
  ☐  Inbox de alertas (funcionário sem saída registrada)
  ☐  Domínio personalizado
  ☐  Multi-empresa (tenancy)
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
