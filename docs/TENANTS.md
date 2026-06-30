# Multi-tenancy — subdomínio e domínio por empresa

Como uma instância única do PontoGlass serve várias empresas, cada uma no seu
endereço (fase 4 do issue #6; fecha o issue #5).

---

## Como o tenant é resolvido

A resolução acontece **no login** (e em forgot-password / recover), em
`lib/tenant.ts → resolveLoginTenant()`, a partir do host do request:

1. **Domínio custom** — se o host bate com `tenants.domain` (ex.
   `ponto.empresa.com`), é esse tenant.
2. **Subdomínio de slug** — se `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` está definido
   (ex. `pontoglass.app`) e o host é `<slug>.<root>`, resolve pelo
   `tenants.slug`. Slug inexistente → o login responde
   `404 Empresa não encontrada` (nunca autentica contra a empresa errada).
3. **Resto** — apex, `www`, `localhost`, previews `*.vercel.app`, ou root
   domain não configurado → tenant **default** (comportamento single-tenant
   de sempre).

Depois do login o host deixa de importar: o `tenant_id` vai dentro do JWT e
**toda** query da API filtra por ele (fase 2). O isolamento de sessão entre
subdomínios vem do próprio cookie: `ponto_token` é host-only (sem atributo
`Domain`), portanto o browser nunca o envia para um subdomínio irmão.

> Por isso o middleware edge **não** consulta o banco por request — seria uma
> query extra em cada navegação sem ganho de segurança. A decisão está
> documentada também no comentário de `resolveLoginTenant()`.

---

## Configurar o subdomínio por slug (`*.pontoglass.app`)

1. **Vercel** → Project → Settings → Domains → adicionar `*.pontoglass.app`
   (exige o domínio raiz no mesmo projeto/conta).
2. **DNS** (no provedor do domínio): registro `A`/`ALIAS` para o apex conforme
   instruções da Vercel, e `CNAME` de `*` para `cname.vercel-dns.com`.
3. **Env**: `NEXT_PUBLIC_TENANT_ROOT_DOMAIN=pontoglass.app` em
   Production (Settings → Environment Variables) e redeploy.
4. Criar o tenant na aba **Empresas** do admin (super-admin) — o formulário
   pede nome, slug e o admin inicial da empresa. Por SQL também funciona:
   ```sql
   INSERT INTO tenants (name, slug) VALUES ('Empresa A', 'empresa-a');
   ```
   (Por SQL é preciso criar o primeiro admin do tenant manualmente; a UI já
   faz as duas coisas na mesma operação.)
5. Aceder a `https://empresa-a.pontoglass.app/login`.

Regras de slug (constraint no schema): minúsculas, `a-z0-9` com hífens
internos, 2–40 caracteres. `www` e o apex nunca são slugs.

---

## Configurar um domínio custom (`ponto.empresa.com`)

1. **Vercel** → Project → Settings → Domains → adicionar `ponto.empresa.com`.
2. **DNS da empresa**: `CNAME ponto → cname.vercel-dns.com`.
3. Registrar o domínio no tenant — aba **Empresas** → Editar → Domínio custom
   (ou por SQL: `UPDATE tenants SET domain = 'ponto.empresa.com' WHERE slug = 'empresa-a';`).
4. O domínio custom tem precedência sobre a resolução por slug.

`tenants.domain` é `UNIQUE` — um domínio só pode apontar para uma empresa.

---

## E-mails

O link de reset de senha é construído com o host do request
(`https://<host-visitado>/reset-password?...`), então cada empresa recebe
links no seu próprio endereço. `NEXT_PUBLIC_APP_URL` continua como fallback
para dev local e para os e-mails de cron (relatório mensal), que na fase
atual servem apenas o tenant default.

---

## Super-admin

O flag `employees.super_admin` (migração v14) marca operadores da plataforma:

- Veem a aba **Empresas** no admin: listar, criar (com admin inicial), editar
  nome/domínio e ativar/desativar tenants. O tenant default não pode ser
  desativado nem eliminado diretamente (os operadores vivem nele) — para isso,
  ver "Separar plataforma de uma empresa-cliente" abaixo.
- A API correspondente é `/api/tenants` (GET/POST) e `/api/tenants/[id]`
  (PATCH) — exige `role=admin` **e** `super_admin=true`, sempre lidos do
  banco, nunca do token.
- O slug é imutável depois de criado (é a URL da empresa).
- Backfill da migração: admins ativos do tenant default viram super-admins.
- Os crons (entry-reminder, absence-check, missing-exit, monthly-report)
  iteram sobre todos os tenants ativos — cada empresa recebe os seus próprios
  lembretes e relatórios.

---

## Separar plataforma de uma empresa-cliente

Numa instalação que serve só a própria empresa, é comum que **a conta de
super-admin e os dados operacionais (funcionários, pontos batidos) vivam no
mesmo tenant default**. Isso é um problema no dia em que essa empresa precisa
ser tratada como um cliente normal — desativada, eliminada, ou simplesmente
isolada do controlo da plataforma — porque o tenant default **não pode ser
desativado** (ver acima): faria isso também tirar o acesso dos operadores.

A ação **"Separar plataforma"** (aba Empresas → linha marcada com o chip
"Plataforma") resolve isto numa operação:

1. Cria um **novo tenant** (nome/slug/domínio que você escolher) — passa a
   ser uma empresa-cliente comum.
2. Move **todos** os dados do tenant default para o novo tenant: funcionários,
   registos de ponto, banco de horas, correções, compensações, feriados,
   audit log, subscrições push, webhooks, templates de turno, aprovações de
   semana, sessões de login e fotos do quiosque.
3. Cria uma **nova conta de controlador** (`super_admin=true`) no tenant
   default, agora vazio — com o nome/usuário/senha que você definir no modal.

### Antes de usar

Execute uma vez no **SQL Editor do Supabase**:
`supabase/migrations/20260630_spin_off_tenant.sql` — cria a função
`spin_off_tenant()` que a rota `/api/tenants/[id]/spin-off` chama. (Instalações
novas a partir do `schema.sql` já ficam com ela, este passo só é necessário em
bancos já existentes.)

### Depois de separar

- Os **funcionários antigos mantêm as mesmas credenciais** — só passam a
  pertencer ao novo tenant. A sessão de quem já estiver logado muda de tenant
  sozinha na próxima requisição (não precisa logout/login):
  `verifyApiAuth` relê `tenant_id` do banco a cada chamada, nunca confia no
  token.
- Quem tinha `super_admin=true` e foi movido para o novo tenant **perde** essa
  flag automaticamente — um admin de empresa-cliente não deve reter poder de
  plataforma.
- A **nova conta de controlador** só vê a aba Empresas; não tem nenhum dado
  operacional associado.
- A empresa migrada já pode ser ativada/desativada/eliminada como qualquer
  outro tenant cliente.

### ⚠️ Nota de segurança

Esta ação é **irreversível por esta ferramenta** — não existe um botão
"desfazer". A migração em si é atómica (tudo ou nada, via transação Postgres),
mas reverter exigiria mover manualmente os dados de volta para o tenant
default. Confirme o nome exato da empresa antes de prosseguir (o modal pede
essa confirmação).

---

## Estado por fase

| Fase | Entrega | Status |
|---|---|---|
| 1 | Schema: tabela `tenants` + `tenant_id` em tudo + backfill | ✅ |
| 2 | JWT com `tenant_id` + filtros em todas as rotas da API | ✅ |
| 3 | RLS lockdown (deny-anon em todas as operações) | ✅ |
| 4 | Resolução por host: domínio custom + slug subdomain | ✅ |
| 5 | Super-admin: aba Empresas, seed de admin, crons multi-tenant | ✅ |
