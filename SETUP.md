# Setup Guide: WhatsApp Lead Followup

Sistema de followup automatico de leads via WhatsApp, usando Supabase Edge Functions e Zapster.

---

## Visao Geral

Quando um lead se cadastra no formulario, o sistema:
1. Salva o lead no banco
2. Notifica o dono no WhatsApp com uma mensagem sugerida para aprovacao
3. Apos aprovacao do dono, envia a mensagem ao lead
4. Agenda followups automaticos nos dias 1, 3, 7 e 14

---

## Pre-requisitos

- Conta no [Supabase](https://supabase.com) (plano free funciona)
- Conta no [Zapster](https://zapster.com.br) com instancia WhatsApp conectada
- Supabase CLI instalado: `brew install supabase/tap/supabase`

---

## Passo 1: Criar projeto no Supabase

1. Acesse o dashboard do Supabase e crie um novo projeto
2. Anote o **Project Ref** (ex: `abcdefghijklm`) em Project Settings > General
3. Anote a **URL do projeto** e a **service_role key** em Project Settings > API Keys > Legacy anon, service_role API keys > service_role (secret)

---

## Passo 2: Linkar o projeto local

```bash
supabase link --project-ref SEU_PROJECT_REF
```

---

## Passo 3: Rodar as migrations

```bash
supabase db push
```

Isso cria todas as tabelas (`leads`, `sequence_messages`, `message_templates`, `pending_approvals`, `inbound_messages`) e popula os templates de mensagem.

---

## Passo 4: Configurar variaveis de ambiente nas Edge Functions

No dashboard do Supabase, va em **Edge Functions > Manage secrets** e adicione:

| Variavel | Descricao |
|---|---|
| `ZAPSTER_API_URL` | URL base da API do Zapster (ex: `https://api.zapster.com.br`) |
| `ZAPSTER_INSTANCE_ID` | ID da instancia WhatsApp no Zapster |
| `ZAPSTER_TOKEN` | Token de autenticacao do Zapster |
| `OWNER_PHONE` | Numero do dono em formato E.164 sem `+` (ex: `5551999998888`) |
| `MEDSHARE_SENDER_PHONE` | Numero do WhatsApp que envia as mensagens (mesmo formato) |

As variaveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sao injetadas automaticamente pelo Supabase.

---

## Passo 5: Fazer deploy das Edge Functions

```bash
supabase functions deploy lead-intake --no-verify-jwt
supabase functions deploy process-due-messages --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

As URLs das funcoes serao:
- `https://SEU_PROJECT_REF.supabase.co/functions/v1/lead-intake`
- `https://SEU_PROJECT_REF.supabase.co/functions/v1/process-due-messages`
- `https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`

---

## Passo 6: Configurar o cron job

No Supabase, va em **SQL Editor** e rode:

```sql
select cron.schedule(
  'process-due-messages',
  '* * * * *',
  $$
    select net.http_post(
      url     := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/process-due-messages',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SEU_SERVICE_ROLE_JWT',
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);
```

> O `SEU_SERVICE_ROLE_JWT` e o valor da `service_role (secret)` key do passo 1 (comeca com `eyJ`).

---

## Passo 7: Configurar o webhook no Zapster

No painel do Zapster, configure o webhook de mensagens recebidas para apontar para:

```
https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook
```

---

## Passo 8: Conectar o formulario de leads

O formulario deve fazer um `POST` para a funcao `lead-intake` com o seguinte body JSON:

```json
{
  "name": "Nome do Lead",
  "phone": "5551999998888",
  "role": "Dono/Socio do Grupo",
  "procedures_per_month": "50-100 procedimentos",
  "problems": "Controle financeiro e agendamento"
}
```

---

## Fluxo de aprovacao (passo 1)

Quando um lead chega, o dono recebe uma notificacao no WhatsApp com a mensagem sugerida. Ele pode:
- Responder **sim**: envia a mensagem sugerida para o lead
- Responder qualquer outra coisa: envia o texto digitado no lugar

---

## Horario dos followups

Os followups automaticos (steps 2 a 5) sao enviados as **10:00 BRT** nos dias correspondentes ao cadastro do lead. Para alterar, edite a linha em `functions/lead-intake/index.ts`:

```ts
target.setUTCHours(13, 0, 0, 0) // 13:00 UTC = 10:00 BRT
```

---

## Monitoramento

Para verificar se o cron esta funcionando, rode no SQL Editor:

```sql
-- Ultimas execucoes do cron
SELECT runid, status, start_time, return_message
FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 10;

-- Ultimas chamadas HTTP (deve retornar status 200)
SELECT status_code, content, created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
```

Se retornar `401`, o token do cron job expirou ou e invalido. Atualize com:

```sql
SELECT cron.alter_job(
  1,
  command := $cmd$
    select net.http_post(
      url     := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/process-due-messages',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SEU_SERVICE_ROLE_JWT_NOVO',
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    );
  $cmd$
);
```

---

## Estrutura das tabelas

| Tabela | Descricao |
|---|---|
| `leads` | Dados do lead (nome, telefone, cargo, etc) |
| `message_templates` | Templates das mensagens por step (0 a 4) |
| `sequence_messages` | Fila de mensagens agendadas por lead |
| `pending_approvals` | Aprovacoes pendentes do dono para o step 1 |
| `inbound_messages` | Mensagens recebidas dos leads |

### Status de `sequence_messages`

| Status | Significado |
|---|---|
| `awaiting_approval` | Step 1 aguardando aprovacao do dono |
| `pending` | Agendado, sera enviado automaticamente |
| `sent` | Enviado com sucesso |
| `skipped` | Lead respondeu, sequencia cancelada |
| `failed` | Erro no envio |
