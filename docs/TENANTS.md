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
4. Criar o tenant com o slug desejado (fase 5 trará UI; até lá, SQL):
   ```sql
   INSERT INTO tenants (name, slug) VALUES ('Empresa A', 'empresa-a');
   ```
5. Aceder a `https://empresa-a.pontoglass.app/login`.

Regras de slug (constraint no schema): minúsculas, `a-z0-9` com hífens
internos, 2–40 caracteres. `www` e o apex nunca são slugs.

---

## Configurar um domínio custom (`ponto.empresa.com`)

1. **Vercel** → Project → Settings → Domains → adicionar `ponto.empresa.com`.
2. **DNS da empresa**: `CNAME ponto → cname.vercel-dns.com`.
3. Registrar o domínio no tenant:
   ```sql
   UPDATE tenants SET domain = 'ponto.empresa.com' WHERE slug = 'empresa-a';
   ```
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

## Estado por fase

| Fase | Entrega | Status |
|---|---|---|
| 1 | Schema: tabela `tenants` + `tenant_id` em tudo + backfill | ✅ |
| 2 | JWT com `tenant_id` + filtros em todas as rotas da API | ✅ |
| 3 | RLS lockdown (deny-anon em todas as operações) | ✅ |
| 4 | Resolução por host: domínio custom + slug subdomain | ✅ |
| 5 | Super-admin: provisionar tenants via UI, crons multi-tenant | ☐ |
