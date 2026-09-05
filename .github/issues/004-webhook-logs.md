---
title: "obs: Webhook delivery logs — retentativas e monitoramento"
labels: observability, webhooks, P0
---

## 🎯 Objetivo

Implementar logging persistente de entregas de webhooks com retentativas automáticas e dashboard de status.

## 📋 Descrição

Webhooks são acionados no `/api/punch` e `/api/records` mas falhas são silenciosas. Faltam:

- Histórico de tentativas (sucesso/falha)
- Retentativas automáticas (max 3 com backoff)
- Dashboard mostrando status por webhook
- Alertas para endpoints com alta taxa de falha

## ✅ Checklist

- [ ] Criar tabela `webhook_delivery_logs`:
  ```sql
  CREATE TABLE webhook_delivery_logs (
    id UUID PRIMARY KEY,
    webhook_id UUID REFERENCES webhook_configs(id),
    tenant_id UUID,
    payload JSONB,
    attempt INT DEFAULT 1,
    status_code INT,
    response_time_ms INT,
    error TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
  );
  ```
- [ ] Implementar função `deliverWebhook()` com retry logic:
  - Tentativa 1: imediata
  - Tentativa 2: +5 min
  - Tentativa 3: +30 min
- [ ] Adicionar middleware de retentativas (Vercel Crons ou Bull queue)
- [ ] Criar aba no admin — **Integrações → Webhooks** (expandir existente)
- [ ] Mostrar por webhook:
  - Total enviados
  - Taxa de sucesso/falha
  - Últimas 20 entregas
  - Tempo médio de resposta
- [ ] Alertar se taxa de falha > 10% nas últimas 24h

## 🔗 Relacionadas

- #301 (Health checks)
- #304 (Alertas Sentry)

## 📚 Referências

- `lib/webhooks.ts` — implementação de envio
- `app/api/cron/*` — scheduler de retentativas
