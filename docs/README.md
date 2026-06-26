# Documentação — PontoGlass

Índice da documentação técnica do projeto.

---

## Documentos disponíveis

| Documento | Descrição |
|-----------|-----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Visão geral da arquitetura, fluxos de autenticação, multi-tenancy, ciclo de ponto, API surface, schema do banco e decisões de design |
| [SECURITY.md](./SECURITY.md) | Threat model, autenticação (JWT, cookies, bcrypt), revogação de sessões, RLS, geofencing, validação de input e cabeçalhos HTTP |
| [TENANTS.md](./TENANTS.md) | Multi-tenancy: resolução de tenant por domínio/slug, isolamento entre tenants, fases de migração e decisões de tenancy |
| [SCHEMA.md](./SCHEMA.md) | Schema completo das tabelas do Supabase com tipos, constraints e índices |
| [security-matrix.md](./security-matrix.md) | Matriz de autorização: todos os endpoints com mecanismo de auth, roles e escopo de tenant |

---

## Setup e operação

Para configurar o ambiente local e fazer deploy, consulte o `README.md` na raiz do projeto.

Variáveis de ambiente necessárias:

| Variável | Uso |
|----------|-----|
| `JWT_SECRET` | Assinar e verificar tokens (≥ 32 chars) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública Supabase (leitura pública limitada por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave server-side (nunca exposta ao cliente) |
| `CRON_SECRET` | Autoriza chamadas dos endpoints `/api/cron/*` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID para Web Push |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID (servidor) |
| `DEFAULT_TENANT_ID` | ID do tenant padrão (single-tenant e super-admins) |
| `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` | Domínio raiz para subdomínios de tenant |
| `SENTRY_DSN` | DSN do Sentry para captura de erros (opcional) |
| `EMAIL_*` | Configuração de e-mail — Graph API ou SMTP |

---

## Recursos adicionais

- **Schema SQL**: `supabase/schema.sql` — schema completo com migrações comentadas
- **Migrações**: `supabase/migrations/` — migrações datadas e idempotentes
- **Testes unitários**: `__tests__/` — vitest, ambiente node
- **Testes E2E**: `e2e/` — Playwright
- **CI**: `.github/workflows/ci.yml` — lint + test + build
