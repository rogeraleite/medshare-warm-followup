# Inputs — medshare-warm-followup

## Formato de Entrada de Lead

Mensagem WhatsApp com prefixo `Potencial Lead:`:

```
Potencial Lead: Nome Completo, 51999998888, Cargo, Volume de procedimentos, Descricao dos problemas
```

Mapeamento para `../../shared_contracts/lead.json`:
- `profile.name` <- Nome Completo
- `profile.phone` <- numero
- `profile.specialty` <- Cargo
- `journey.notes[0]` <- Volume de procedimentos + problemas

## Dependencias de Configuracao

| Segredo | Uso |
|---------|-----|
| `ZAPSTER_API_URL` | API WhatsApp |
| `ZAPSTER_TOKEN` | Autenticacao Zapster |
| `ZAPSTER_INSTANCE_ID` | Instancia do numero MedShare |
| `MEDSHARE_SENDER_PHONE` | Numero que envia as mensagens |
| `OWNER_PHONE` | Numero do owner que aprova |
| `SUPABASE_URL` | Conexao banco |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso administrativo |

## Contrato de entrada
- `../../shared_contracts/lead.json` — lead registrado no Supabase apos entrada
