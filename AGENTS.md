# Agents — medshare-warm-followup

## Contexto
Este projeto e um sistema de automacao de follow-up, nao um squad de geracao de conteudo.
Agentes LLM sao usados para personalizar mensagens, nao para executar pipelines visuais.

## Agentes Permitidos

### Sales (ref: ../../shared_agents/sales.md)
- Personalizar mensagem de follow-up por persona e step
- Adaptar tom ao estagio do lead (new, contacted, trial)
- Inputs: `lead.json` (perfil + journey.followup_step), `shared_context/SALES_ARGUMENTS.md`

### Copywriter (ref: ../../shared_agents/copywriter.md)
- Reescrever template de mensagem quando solicitado manualmente
- Adaptar tom sem perder a estrutura da sequencia

## Acoes Permitidas

- Ler e editar templates em `supabase/migrations/` e `supabase/functions/_shared/templates.ts`
- Ler contexto de produto em `medshare-product.md`
- Consultar `../../shared_context/PERSONAS.md` e `SALES_ARGUMENTS.md`
- Fazer deploy de Edge Functions via CLI Supabase

## Acoes Proibidas

- Nao deletar ou truncar tabelas do banco sem instrucao explicita
- Nao alterar a logica de aprovacao do owner sem revisao humana
- Nao enviar mensagens reais em ambiente de producao em testes
- Deploy de `whatsapp-webhook` DEVE usar `--no-verify-jwt`

## Constraints

- Toda mensagem editada deve respeitar `../../shared_context/BRAND_VOICE.md`
- Steps de follow-up definidos em `../../shared_context/SALES_ARGUMENTS.md` sao a referencia
- Nao personalizar mensagem alem do que os placeholders suportam sem alterar o schema
