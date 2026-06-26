# Matriz de Autorização — API Endpoints

Mapeamento de todos os endpoints da API com mecanismo de autenticação, roles permitidas, escopo de tenant e status de cobertura.

Legenda de autenticação:
- **JWT** — cookie `ponto_token` validado por `verifyApiAuth` (assinatura + ativo + `sessions_valid_from`)
- **Público** — sem autenticação (ex: login, recuperação de senha)
- **CRON** — header `Authorization: Bearer CRON_SECRET`
- **Kiosk token** — token de quiosque armazenado em `tenants.kiosk_token`, enviado no body/query
- **QR token** — HMAC por funcionário, comparação constant-time

---

## Auth / Sessão

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/auth/login` | POST | Público | — | Resolvido por host/slug | ✅ OK |
| `/api/auth/login/totp` | POST | Público (TOTP pending token) | — | Via token TOTP | ✅ OK |
| `/api/auth/login/backup` | POST | Público (backup code) | — | Via username | ✅ OK |
| `/api/auth/logout` | POST | JWT | Qualquer | — | ✅ OK |
| `/api/auth/password` | PUT | JWT | Qualquer (self) | Via JWT | ✅ OK |
| `/api/auth/forgot-password` | POST | Público | — | Via e-mail/username | ✅ OK |
| `/api/auth/reset-password` | POST | Público (reset token) | — | Via token | ✅ OK |
| `/api/auth/recover` | POST | Público (`RECOVERY_SECRET`) | — | Via username | ✅ OK |
| `/api/auth/revoke-other-sessions` | POST | JWT | Qualquer (self) | Via JWT | ✅ OK |
| `/api/auth/totp` | GET | JWT | Qualquer (self) | Via JWT | ✅ OK |
| `/api/auth/totp` | POST | JWT | Qualquer (self) | Via JWT | ✅ OK |
| `/api/auth/confirm-email` | GET | Público (e-mail token) | — | Via token | ✅ OK |

---

## Perfil e sessões

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/me` | GET | JWT | Qualquer | Via JWT + DB | ✅ OK |
| `/api/me` | PATCH | JWT | Qualquer (self) | Via JWT + DB | ✅ OK |
| `/api/login-sessions` | GET | JWT | Qualquer (self) | Via JWT | ✅ OK |
| `/api/login-sessions` | DELETE | JWT | Qualquer (self) | Via JWT | ✅ OK |
| `/api/push-subscribe` | POST | JWT | Qualquer | Via JWT | ✅ OK |
| `/api/push-subscribe` | DELETE | JWT | Qualquer | Via JWT | ✅ OK |

---

## Ponto

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/punch` | POST | JWT | employee (self) / admin / manager (on-behalf) | Via JWT + tenant_id | ✅ OK |
| `/api/records` | GET | JWT | employee (self) / admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/records` | POST | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/records/[id]` | PATCH | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/records/[id]` | DELETE | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/records/bulk` | POST | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |

---

## Quiosque e QR

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/kiosk/token` | GET | JWT | admin / manager | Via JWT | ✅ OK |
| `/api/kiosk/token` | POST | JWT | admin / manager | Via JWT | ✅ OK |
| `/api/kiosk/employees` | GET | Kiosk token | — (token valida tenant) | Via kiosk_token → tenant | ✅ OK |
| `/api/kiosk/punch` | POST | Kiosk token | — (token valida tenant) | Via kiosk_token → tenant | ✅ OK |
| `/api/kiosk-photos` | POST | JWT | admin / manager | Via JWT | ✅ OK |
| `/api/kiosk-photos` | GET | JWT | admin / manager | Via JWT | ✅ OK |
| `/api/qr` | GET | JWT | employee (self) | Via JWT + tenant_id | ✅ OK |
| `/api/qr/punch` | POST | QR token (HMAC) | — (token por funcionário) | Via tenantId no body | ✅ OK |

---

## Funcionários

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/employees` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/employees` | POST | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/employees/[id]` | PATCH | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/employees/[id]` | DELETE | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/employees/import` | POST | JWT | admin | Via JWT + tenant_id | ✅ OK |

---

## Correções e compensações

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/correction-requests` | GET | JWT | employee (self) / admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/correction-requests` | POST | JWT | employee (self) | Via JWT + tenant_id | ✅ OK |
| `/api/correction-requests/[id]` | PATCH | JWT | admin / manager (aprovação) | Via JWT + tenant_id | ✅ OK |
| `/api/compensation-requests` | GET | JWT | employee (self) / admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/compensation-requests` | POST | JWT | employee (self) | Via JWT + tenant_id | ✅ OK |
| `/api/compensation-requests/[id]` | PATCH | JWT | admin / manager (aprovação) | Via JWT + tenant_id | ✅ OK |

---

## Banco de horas

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/hour-bank` | GET | JWT | employee (self) / admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/hour-bank` | POST | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/hour-bank/[id]` | DELETE | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/timesheet-approvals` | GET | JWT | employee (self) / admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/timesheet-approvals` | POST | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/timesheet-approvals` | DELETE | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |

---

## Feriados e exceções

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/day-exceptions` | GET | JWT | Qualquer | Via JWT + tenant_id | ✅ OK |
| `/api/day-exceptions` | POST | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/day-exceptions/[id]` | DELETE | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |

---

## Relatórios e auditoria

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/reports` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/reports/absences` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/reports/calendar` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/reports/punctuality` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/audit` | GET | JWT | admin | Via JWT + tenant_id | ✅ OK |

---

## Configurações de tenant

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/tenant-settings` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/tenant-settings` | PATCH | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/tenant-settings/test-notification` | POST | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/webhook-configs` | GET | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/webhook-configs` | POST | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/webhook-configs` | PATCH | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/webhook-configs` | DELETE | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/shift-templates` | GET | JWT | admin / manager | Via JWT + tenant_id | ✅ OK |
| `/api/shift-templates` | POST | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/shift-templates` | DELETE | JWT | admin | Via JWT + tenant_id | ✅ OK |
| `/api/shift-templates/apply` | POST | JWT | admin | Via JWT + tenant_id | ✅ OK |

---

## Tenants (super-admin)

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/tenants` | GET | JWT | admin + super_admin | Cross-tenant (super_admin) | ✅ OK |
| `/api/tenants` | POST | JWT | admin + super_admin | — (cria novo tenant) | ✅ OK |
| `/api/tenants/[id]` | PATCH | JWT | admin + super_admin | Target tenant | ✅ OK |
| `/api/tenants/[id]` | DELETE | JWT | admin + super_admin | Target tenant | ✅ OK |

---

## Crons

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/cron/absence-check` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |
| `/api/cron/missing-exit` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |
| `/api/cron/entry-reminder` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |
| `/api/cron/monthly-report` | GET/POST | CRON_SECRET ou JWT admin | admin (POST manual) | Multi-tenant loop | ✅ OK |
| `/api/cron/weekly-report` | GET/POST | CRON_SECRET ou JWT admin | admin (POST manual) | Multi-tenant loop | ✅ OK |
| `/api/cron/absence-check` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |
| `/api/cron/hour-bank-cap` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |
| `/api/cron/alert-check` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |
| `/api/cron/punch-out-reminder` | GET | CRON_SECRET | — | Multi-tenant loop | ✅ OK |

---

## Saúde e diagnóstico

| Endpoint | Método | Auth | Role permitida | Escopo tenant | Status |
|----------|--------|------|----------------|---------------|--------|
| `/api/health` | GET | Público | — | — | ✅ OK |

---

## Resumo de riscos

| Área | Observação |
|------|------------|
| `/api/kiosk/employees` e `/api/kiosk/punch` | Públicos por design — autenticados por `kiosk_token` via DB. Token deve ter entropy suficiente e ser rotacionável pelo admin. |
| `/api/qr/punch` | Público por design — HMAC por funcionário com comparação constant-time. Válido apenas para o `tenantId` e `employeeId` do body. |
| `/api/auth/recover` | Público, protegido por `RECOVERY_SECRET`. Não configure em produção se não for necessário. |
| `/api/health` | Público e sem informações sensíveis — apenas status da aplicação. |
| Crons | Todos verificam `Bearer CRON_SECRET`. Sem segredo configurado, respondem 401. |
| Tenant isolation | Todas as queries da API filtram por `tenant_id` do JWT. `super_admin` é o único flag com acesso cross-tenant, carregado do DB por request. |
