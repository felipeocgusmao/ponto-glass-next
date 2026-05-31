# Security

Como o PontoGlass protege credenciais, sessões e dados sensíveis.

---

## Threat model

Atacantes considerados:

1. **Externo não autenticado** — tenta brute-force no `/login`, descobrir endpoints, ler dados sem token
2. **Funcionário autenticado** — tenta ver/editar dados de outros funcionários
3. **Sessão roubada** — atacante com cópia de um `ponto_token` válido
4. **Insider com acesso ao DB** — tem `SUPABASE_SERVICE_ROLE_KEY`

A defesa cobre 1-3. Para (4) o controlo é organizacional (rotação de chaves, audit logs no Supabase).

---

## Autenticação

### Senhas

- **Hash**: `bcrypt` com salt automático (`bcryptjs@^2.4.3`). Custo padrão (10 rounds).
- **Comparação timing-safe**: `bcrypt.compare()` previne timing attacks. Quando o utilizador não existe, comparamos contra um hash dummy para que o tempo de resposta não revele a existência de contas.
- **Minimo**: 6 caracteres (verificado tanto no cliente como no servidor).
- **Nunca em texto plano**: nem em logs, nem em response bodies, nem em URLs.

### JWT

- **Algoritmo**: HS256 (`jose@^5`). Edge-compatible (não usa Node crypto APIs).
- **Validade**: 8 horas (`setExpirationTime('8h')`).
- **Payload**: `{ id, name, username, role, iat, exp }`.
- **Segredo**: `JWT_SECRET` (≥ 32 caracteres). Configurado em env, nunca commitado.

### Cookies

```ts
res.cookies.set('ponto_token', token, {
  httpOnly: true,              // JavaScript não consegue ler (mitiga XSS)
  secure: process.env.NODE_ENV === 'production',  // só HTTPS em produção
  sameSite: 'lax',             // protege CSRF em requests cross-site
  maxAge: 60 * 60 * 8,         // 8h em segundos
  path: '/',
})
```

Equivalente para [chrome cookie docs](https://developer.chrome.com/blog/cookie-max-age-expires).

### Revogação de sessões

Tokens stateless são intrinsecamente difíceis de revogar. Solução híbrida:

1. **Coluna `employees.sessions_valid_from`** (TIMESTAMP, default epoch).
2. **`verifyApiAuth`** (em `lib/apiAuth.ts`) compara `token.iat` com `sessions_valid_from`. Tokens com `iat < sessions_valid_from` são rejeitados.
3. **Atualização** acontece em:
   - **Logout**: `UPDATE employees SET sessions_valid_from = NOW() WHERE id = me`
   - **Troca de senha** (self): mesmo update. O caller re-emite um token "back-dated 2s" para manter a sessão ativa.
   - **Reset de senha** (via link): mesmo update.
   - **Recover** (chave de emergência): mesmo update.
   - **Admin trocando senha de outro**: mesmo update no target.

**Trade-off**: a verificação só acontece nas API routes (não no middleware edge). Isto evita uma query ao DB por request, mantendo o edge rápido. O lado privado da app (`/admin`, `/ponto`) sempre faz `fetch('/api/me')` no mount → revogação detectada em ≤ 1 navegação.

**Resiliência**: se a coluna não existir (migração v9 não aplicada), `verifyApiAuth` degrada para signature-only. Não tranca ninguém.

### Tokens de reset de senha

- **TTL**: 1 hora.
- **Claim `pwh`**: SHA-256(password_hash atual) truncado a 16 hex (64 bits).
- **Validação**: `pwh` no token deve bater com o hash atual da senha. Qualquer troca de senha invalida o link.
- **Limitação conhecida** (issue #72): 64 bits é menos que o ideal, mas dentro da janela de 1h e considerando o threat model é suficiente. Migração para `jti` em DB planeada.

---

## Rate limiting

`lib/rateLimit.ts` implementa um sliding window simples.

- **Store primário**: Vercel KV ou Upstash Redis (se `KV_REST_API_URL` ou `UPSTASH_REDIS_REST_URL` definidos).
- **Fallback**: `Map` em memória do processo (limita ataques óbvios mas é ineficaz em serverless por causa dos cold starts).
- **Chave**: `${endpoint}:${IP}` para login/reset/recover/forgot, `${endpoint}:${employeeId}` para punch.

| Endpoint | Limite |
|----------|--------|
| `POST /api/auth/login` | 5/15min por IP |
| `POST /api/auth/forgot-password` | 3/15min por IP |
| `POST /api/auth/reset-password` | 5/15min por IP |
| `POST /api/auth/recover` | 5/15min por IP |
| `POST /api/punch` | 10/60s por employee |

**Recomendação**: configurar Vercel KV em produção (~zero custo). Sem ele o rate-limit é cosmético em deploy serverless.

---

## RBAC (Role-Based Access Control)

Roles: `admin`, `manager`, `employee`.

- **Edge middleware** (`middleware.ts`): redireciona empregados para `/ponto`, gestores/admin para `/admin`. Bloqueia o acesso direto a rotas privilegiadas.
- **API routes**: cada uma verifica `user.role` quando relevante.
  ```ts
  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  ```
- **Audit log**: toda a alteração administrativa registra `actor_id`, `actor_name`, `action`, `target_*` e `details`. Histórico em `audit_logs`.

---

## Geofencing

Validação por funcionário (`employees.workplace_lat`, `workplace_lng`, `max_distance_meters`).

- Cálculo de distância: **Haversine** no servidor (`lib/utils.haversineMeters`). O cliente não pode falsificar o resultado — só envia `lat/lng`, o servidor calcula.
- Quando `geo_mode === 'required'` e o trabalhador está fora do raio: `400 Fora do local`.
- Quando `geo_mode === 'optional'`: aceita batidas sem localização (apenas regista quando enviada).
- Quando `geo_mode === 'disabled'`: localização nunca é exigida nem validada.
- Admin/manager batendo on-behalf: **não** aplica geofencing (assumimos contexto presencial).

---

## Validação de input

- **`zod`** *não* é usado; a validação é manual em cada API route (mais simples para um projeto deste tamanho).
- **Tipos de punch**: lista branca `VALID_TYPES`.
- **E-mails**: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` + lowercase + trim.
- **Datas**: parseadas como `YYYY-MM-DD` e comparadas como strings (formato lexicograficamente ordenável).
- **Períodos de relatório**: máximo 366 dias, máximo 2000 rows por response (truncado com flag `truncated`).

---

## Web Push (VAPID)

- Chaves: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (no cliente) + `VAPID_PRIVATE_KEY` (server-only).
- **Privada nunca sai do servidor**.
- Identidade: `VAPID_EMAIL` (mailto) — usado pelo browser do utilizador como ponto de contacto.
- Subscriptions guardadas em `push_subscriptions` (uma por dispositivo).

---

## E-mail (OAuth Client Credentials)

Quando configurado, o e-mail é enviado via **Microsoft Graph API** (OAuth 2.0 client credentials, sem licença por caixa).

- `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_SENDER_EMAIL`
- Token obtido a cada invocação (não cached — invocações pouco frequentes).
- **Fallback automático para SMTP** se a chamada à Graph falhar ou se as 4 vars não estiverem definidas.
- Credenciais Graph **nunca** expostas ao cliente (não têm prefixo `NEXT_PUBLIC_`).

---

## Segredos e ambiente

- Todos os segredos em variáveis de ambiente. Nunca em `git` (`.env.local` está em `.gitignore`).
- `.env.example` lista tudo com placeholders + instruções para gerar.
- Em Vercel: configurar via Project Settings → Environment Variables. Diferentes valores para `Preview` vs `Production`.
- **Rotação**: rodar JWT_SECRET invalida todos os tokens (todos os utilizadores precisam re-login). Use em incidentes.
- **CRON_SECRET**: obrigatório para o cron funcionar; sem ele os endpoints `/api/cron/*` recusam todas as chamadas.

---

## Service Worker

`public/sw.js`:

- Cache **network-first** para HTML (sempre tenta rede primeiro).
- Rotas privadas (`/ponto`, `/admin`, `/kiosk`) **nunca** são cacheadas.
- API routes nunca são cacheadas.
- Apenas assets estáticos versionados (`/_next/static/*`) podem ser servidos do cache.

---

## Recomendações de deploy

### Obrigatório
- [ ] `JWT_SECRET` ≥ 32 caracteres (gerar com `openssl rand -base64 32`)
- [ ] `CRON_SECRET` definido (se for usar os cron jobs)
- [ ] `NEXT_PUBLIC_BUSINESS_TZ` configurado para o fuso da empresa
- [ ] HTTPS em produção (Vercel já garante)

### Fortemente recomendado
- [ ] Vercel KV ou Upstash Redis para rate limit distribuído
- [ ] `RECOVERY_SECRET` único e armazenado em local seguro
- [ ] Sentry configurado para captura de erros
- [ ] Aplicar todas as migrações em `supabase/migrations/`

### Opcional
- [ ] Microsoft Graph para e-mail (sem custo por caixa)
- [ ] VAPID para push notifications
- [ ] `INITIAL_ADMIN_PASSWORD` definido para o primeiro arranque

---

## Issues de segurança conhecidas

Listadas no GitHub com label `security`:

- **#72** — Token de reset usa fingerprint de 64 bits (severidade baixa)
- **#65** — Rate-limit em memória ineficaz em serverless **(resolvido em PR #74 — agora distribuído via KV)**
- **#66** — Sessões JWT não revogadas **(resolvido em PR #75 — via sessions_valid_from)**

---

## Reportar vulnerabilidades

Por favor não abrir issues públicas para vulnerabilidades reais. Contactar diretamente o repositório (issue privada ou e-mail do owner) com:
- Descrição do problema
- Passos para reproduzir
- Impacto estimado
- Sugestão de fix (opcional)
