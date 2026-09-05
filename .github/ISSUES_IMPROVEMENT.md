# 🚀 Melhorias Estruturadas — PontoGlass

Documento de referência para as issues de melhoria criadas (52 issues totais em 6 categorias).

## 📊 Resumo Executivo

| Categoria | Issues | Esforço | Impacto | Prioridade |
|-----------|--------|---------|---------|-----------|
| 🔍 Observabilidade | #301-305 | 2-3 dias | Alto | P0 |
| ⚡ Performance | #306-310 | 3-4 dias | Alto | P0 |
| 🧪 Qualidade | #311-315 | 2-3 dias | Médio | P1 |
| 🔒 Segurança | #316-320 | 2-3 dias | Alto | P0 |
| 🚀 DevOps | #321-325 | 1-2 dias | Médio | P1 |
| 👥 UX | #326-330 | 2-3 dias | Médio | P2 |

---

## 🔍 Observabilidade & Monitoramento (Issues #301–#305)

Adicionar visibilidade operacional ao sistema.

### #301 — Health checks granulares e métricas
- [ ] Expandir `/api/health/deep` com métricas de performance
- [ ] Database latency percentiles (p50, p95, p99)
- [ ] Cache hit rates (Redis/KV)
- [ ] Webhook delivery success rate

### #302 — Logging estruturado (JSON + trace IDs)
- [ ] Implementar winston/pino com correlação
- [ ] Session ID + trace ID em todos os logs
- [ ] Integração com Sentry (já existe, melhorar)

### #303 — Rate limit observability
- [ ] Dashboard de hits por IP/usuário
- [ ] Histórico de lockouts
- [ ] Alertas para padrões suspeitos

### #304 — Webhook delivery logs persistentes
- [ ] Tabela `webhook_delivery_logs`
- [ ] Retentativas automáticas (max 3)
- [ ] Dashboard de falhas/sucesso

### #305 — Alertas configuráveis no Sentry
- [ ] Threshold de erro rate (% de requests falhando)
- [ ] Notificação em Slack/Discord

---

## ⚡ Performance & Escalabilidade (Issues #306–#310)

Otimizações para crescimento horizontal.

### #306 — Caching ISR para relatórios
- [ ] Implementar ISR (Incremental Static Regeneration)
- [ ] Cache de 1 hora para relatórios históricos
- [ ] Invalidação ao novo punch/correção

### #307 — Database indexes
- [ ] `records(employee_id, date)` — queries por período
- [ ] `correction_requests(status, created_at)`
- [ ] `audit_logs(actor_id, created_at)`
- [ ] Benchmark antes/depois

### #308 — Redis caching para `/api/records`
- [ ] Cache GET /api/records com TTL 5 min
- [ ] Invalidação ao novo punch
- [ ] Fall-through ao DB se cache miss

### #309 — Aggregação de hour_bank no Postgres
- [ ] Function RPC tenant-scoped
- [ ] Materialização de snapshots mensais
- [ ] Teste de performance com 10k+ registros

### #310 — Connection pooling Supabase
- [ ] Validar PgBouncer configuration
- [ ] Benchmark de conexões simultâneas

---

## 🧪 Qualidade de Código & Testes (Issues #311–#315)

Aumentar cobertura e confiabilidade.

### #311 — Aumentar cobertura de testes (target: 85%)
- [ ] Cenários de erro de rede
- [ ] Rate limit exhaustion
- [ ] Geofencing failures
- [ ] SMTP/Graph timeouts

### #312 — Load testing (k6 ou Artillery)
- [ ] Simular 100 concurrent users
- [ ] Stress test no `/api/punch`
- [ ] Memory leak detection

### #313 — Mutation testing (Stryker)
- [ ] Validar que testes realmente testam
- [ ] Target: 80%+ mutation score

### #314 — Integration tests com BD real
- [ ] Transactions + rollback
- [ ] RLS policies validation
- [ ] Fixture factory

### #315 — E2E tests no Playwright
- [ ] Novo: fluxo de correção de registo
- [ ] Novo: geofencing + auto punch-out
- [ ] Novo: bulk operations (admin)

---

## 🔒 Segurança & Compliance (Issues #316–#320)

Fortalecer postura de segurança.

### #316 — CSRF protection explícita
- [ ] Adicionar anti-CSRF token em formulários
- [ ] Validar `origin` header
- [ ] Teste de CSRF attack

### #317 — Rate limit por tenant
- [ ] Hoje é global — isolar por `tenant_id`
- [ ] Limites customizáveis por plano
- [ ] Suportar whitelist de IPs

### #318 — Audit trail imutável
- [ ] Tabela append-only `immutable_audit_log`
- [ ] Hash chain (cada row referencia hash anterior)
- [ ] Compliance GDPR/fiscal

### #319 — Data retention policy
- [ ] Deletar registros após 7 anos
- [ ] GDPR "right to be forgotten"
- [ ] Cron job mensal

### #320 — Penetration testing
- [ ] Contratar security audit
- [ ] OWASP Top 10 validation
- [ ] Report + remediation plan

---

## 🚀 DevOps & Deployment (Issues #321–#325)

Melhorar confiabilidade operacional.

### #321 — Blue-green deployments
- [ ] Preview envs automáticos em Vercel
- [ ] Health check antes de switch
- [ ] Rollback automático se falhar

### #322 — Database migration testing
- [ ] Testar migrations em staging antes
- [ ] Dry-run com backup restore
- [ ] Playbook de rollback

### #323 — Secrets rotation policy
- [ ] Rotação mensal de `JWT_SECRET`
- [ ] Rotação trimestral de `CRON_SECRET`
- [ ] Rotação de VAPID keys
- [ ] Automação via GitHub Actions

### #324 — Disaster recovery testing
- [ ] Backup restore validation (mensal)
- [ ] RTO/RPO targets documentados
- [ ] Playbook de recovery
- [ ] DR drill anual

### #325 — Multi-region failover
- [ ] Adicionar réplica em outra região
- [ ] DNS failover (Cloudflare)
- [ ] Teste de failover

---

## 👥 Experiência do Usuário (Issues #326–#330)

Melhorias visuais e de funcionalidade.

### #326 — Modo offline avançado
- [ ] Validação de duplicatas offline
- [ ] Retry inteligente com backoff exponencial
- [ ] Indicador de sync status

### #327 — Bulk operations (admin)
- [ ] Corrigir múltiplos registros
- [ ] Importar lote de funcionários
- [ ] Exportar dados em bulk

### #328 — Undo/Redo local
- [ ] Histórico de ações do usuário
- [ ] Desfazer última ação
- [ ] Refazer (Ctrl+Y)

### #329 — Mobile UX refinement
- [ ] Teste em iPhone 12, 14 (notch)
- [ ] Teste em Android (Samsung, Pixel)
- [ ] Orientação portrait/landscape
- [ ] Teclado virtual nativo

### #330 — Notificações inteligentes
- [ ] Priority levels (critical/info)
- [ ] Batch notifications (max 1/hour)
- [ ] User preference center

---

## 🔗 Issues Relacionadas (já abertas)

| # | Título | Status |
|---|--------|--------|
| #146 | infra: configurar domínio próprio + wildcard DNS | open |
| #255 | infra: configurar Vercel KV (rate limit distribuído) | open |
| #266 | chore: migrar URLs para pontoglass.com | open |
| #267 | perf: agregar banco de horas no Postgres | open |
| #268 | perf: semear "Meu Ponto" no servidor (managers) | open |
| #284 | feat: fuso horário por empresa (tenant) | open |

---

## 📅 Roadmap Sugerido

### Q3 2026 (Próximas 2 semanas)
- [ ] #301–#305 (Observabilidade)
- [ ] #306–#310 (Performance)

### Q3 2026 (Semanas 3–4)
- [ ] #311–#315 (Qualidade)
- [ ] #316–#320 (Segurança)

### Q4 2026 (Setembro+)
- [ ] #321–#325 (DevOps)
- [ ] #326–#330 (UX)

---

## 🤝 Como Contribuir

1. Escolha uma issue
2. Comente `@felipeocgusmao I'll work on this`
3. Crie um branch: `git checkout -b feat/issue-XXX`
4. Abra um PR com referência: `Fixes #XXX`
5. Rebase + squash before merge

---

Última atualização: 2026-09-05
