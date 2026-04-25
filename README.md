# MedShare WhatsApp Lead Follow-up

Automacao de follow-up por WhatsApp para leads quentes da MedShare. O sistema registra o lead, pede aprovacao humana da primeira mensagem, continua a sequencia automaticamente e interrompe tudo assim que houver resposta.

## Navegacao Rapida

- Se voce quer mexer no **schema e templates default**, comece em `supabase/migrations/20260326000000_initial_schema.sql`
- Se voce quer mexer no **webhook de entrada**, olhe `supabase/functions/whatsapp-webhook/`
- Se voce quer mexer no **processamento agendado das mensagens**, olhe `supabase/functions/process-due-messages/`
- Se voce quer mexer na **entrada HTTP direta de leads**, olhe `supabase/functions/lead-intake/`
- Se voce quer entender o **contexto do produto**, leia `medshare-product.md`
- Se voce quer setup operacional detalhado, complemente com `SETUP.md`

## Como Funciona

1. Um lead entra com o prefixo `Potencial Lead:`
2. O sistema registra o lead e notifica o owner no WhatsApp pessoal
3. O owner aprova a mensagem sugerida ou reescreve
4. A primeira mensagem e enviada
5. Follow-ups automaticos saem em janelas predefinidas
6. Se o lead responder, a sequencia para e o owner e avisado

## Sequencia De Mensagens

| Step | Delay | Tipo | Objetivo |
|------|-------|------|----------|
| 0 | immed | text | primeiro contato aprovado pelo owner |
| 1 | +1d | text | lembrete |
| 2 | +3d | video link | demo |
| 3 | +7d | text | personalizacao pela dor |
| 4 | +14d | text | ultima tentativa |

## Mapa Do Projeto

- `supabase/migrations/20260326000000_initial_schema.sql`
  schema principal e templates iniciais
- `supabase/functions/whatsapp-webhook/`
  lida com mensagens recebidas do Zapster
- `supabase/functions/process-due-messages/`
  cron que dispara mensagens pendentes
- `supabase/functions/lead-intake/`
  endpoint opcional para registrar leads por HTTP
- `supabase/functions/_shared/templates.ts`
  placeholders e renderizacao de templates
- `SETUP.md`
  guia complementar de operacao
- `medshare-product.md`
  contexto de produto para copy e ajustes

## Se Voce Quer Alterar X, Va Para Y

- **Mensagem sugerida, placeholders e copy base**
  migration inicial e `_shared/templates.ts`
- **Fluxo de aprovacao do owner**
  `supabase/functions/whatsapp-webhook/`
- **Regra de envio por tempo**
  `supabase/functions/process-due-messages/`
- **Forma de registrar leads**
  `supabase/functions/lead-intake/` e `whatsapp-webhook/`
- **Segredos e configuracao externa**
  `.env.example`, `supabase secrets`, e `SETUP.md`

## Arquitetura

```text
FlutterFlow ou cadastro manual
    ->
WhatsApp MedShare via Zapster
    ->
whatsapp-webhook
    -> registra lead
    -> conduz aprovacao do owner
    -> detecta resposta do lead e interrompe a cadencia

pg_cron
    ->
process-due-messages
    -> envia mensagens pendentes
```

## Formato De Registro De Lead

```text
Potencial Lead: Nome Completo, 51999998888, Cargo, Volume de procedimentos, Descricao dos problemas
```

- Numeros brasileiros podem ir com DDD + numero
- Numeros internacionais devem incluir `+`
- O campo de problemas pode conter virgulas

## Variaveis E Integracoes

Stack principal:
- `Supabase`
- `Zapster API`
- `FlutterFlow`

Segredos relevantes:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZAPSTER_API_URL`
- `ZAPSTER_TOKEN`
- `ZAPSTER_INSTANCE_ID`
- `MEDSHARE_SENDER_PHONE`
- `OWNER_PHONE`

Copie `.env.example` para `.env` no ambiente local.

## Setup

### 1. Banco

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### 2. Secrets

```bash
supabase secrets set \
  ZAPSTER_API_URL=https://new-api.zapsterapi.com/v1 \
  ZAPSTER_TOKEN=<token> \
  ZAPSTER_INSTANCE_ID=<instance-id> \
  MEDSHARE_SENDER_PHONE=<number> \
  OWNER_PHONE=<number>
```

### 3. Functions

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy process-due-messages
```

### 4. Cron

Configure `pg_cron` para chamar `process-due-messages` a cada minuto.

### 5. Webhook Zapster

Use:

```text
https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook
```

Evento: `Mensagem Recebida`

## Templates

Placeholders suportados em `message_templates`:
- `{{first_name}}`
- `{{role}}`
- `{{procedures}}`
- `{{problems}}`
