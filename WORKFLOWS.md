# Workflows — medshare-warm-followup

## Workflow 1: Entrada de Novo Lead

```
1. Lead envia mensagem WhatsApp para numero MedShare
   Formato: "Potencial Lead: Nome, telefone, cargo, volume, problemas"
2. whatsapp-webhook recebe e detecta o prefixo
3. Lead registrado no Supabase (status: "new")
4. Owner notificado com resumo do lead + primeira mensagem sugerida
5. Owner aprova (envia a mensagem) ou reescreve
6. Primeira mensagem enviada ao lead (status: "contacted", step: 0)
```

## Workflow 2: Sequencia de Follow-up Automatico

```
pg_cron (a cada minuto)
    -> process-due-messages verifica mensagens com due_at <= now()
    -> Para cada mensagem pendente:
       - Renderiza template com placeholders do lead
       - Envia via Zapster API
       - Incrementa followup_step
       - Registra timestamp em journey.last_interaction
```

| Step | Delay | Tipo | Objetivo |
|------|-------|------|----------|
| 0 | imediato | texto | primeiro contato (aprovacao manual) |
| 1 | +1 dia | texto | lembrete |
| 2 | +3 dias | link video | demo |
| 3 | +7 dias | texto | personalizacao pela dor |
| 4 | +14 dias | texto | ultima tentativa |

## Workflow 3: Resposta do Lead (Interrupcao)

```
1. Lead responde qualquer mensagem
2. whatsapp-webhook detecta resposta (nao e prefixo de lead novo)
3. Sequencia de follow-up pausada (status: "contacted" mantido)
4. Owner notificado: "Lead <nome> respondeu"
5. Owner continua manualmente via WhatsApp
```

## Workflow 4: Deploy de Alteracao

```
1. Editar template ou logica em supabase/functions/
2. Testar localmente: supabase functions serve
3. Deploy:
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   supabase functions deploy process-due-messages
4. Verificar logs: supabase functions logs
```

## Dependencias Cross-Projeto

- Leads podem originar de `medshare-landingpage` (formulario de conversao)
- Contexto de argumentos: `../../shared_context/SALES_ARGUMENTS.md`
