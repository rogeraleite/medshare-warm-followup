# Outputs — medshare-warm-followup

## O que este projeto produz

### Mensagens enviadas ao lead
- Sequencia de 5 mensagens via Zapster API (WhatsApp)
- Cada mensagem renderizada com placeholders do template

### Notificacoes ao owner
- Notificacao de novo lead recebido
- Preview da primeira mensagem para aprovacao
- Alerta quando lead responde (sequencia parada)

### Estado persistido no Supabase

Tabelas principais:
- `leads` — perfil do lead (ref: `../../shared_contracts/lead.json`)
- `messages` — historico de mensagens enviadas
- `message_templates` — templates com placeholders

### Contrato de saida
- `../../shared_contracts/lead.json` — status atualizado a cada interacao
  - `status`: new -> contacted -> (trial | lost)
  - `journey.followup_step`: incrementado a cada mensagem
  - `journey.last_interaction`: timestamp atualizado

## Nao produz
- Nao gera posts ou conteudo visual
- Nao tem interface frontend propria
