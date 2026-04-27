# Prompts — Sequencia de Follow-up WhatsApp

**Usado em:** `supabase/functions/_shared/templates.ts`
**Agente:** `shared_agents/sales.md`
**Contrato de entrada:** `shared_contracts/lead.json`

---

## Contexto de produto (injetado em todos os steps)

O MedShare e um software de gestao financeira para grupos cirurgicos e anestesistas freelancers no Brasil.

Principais funcionalidades:
- Calculo automatico de honorario por procedimento (CBHPM + tempo PACU)
- Divisao de honorarios entre membros do grupo
- Relatorios financeiros mensais
- Emissao de documentos cirurgicos digitais
- Controle de procedimentos e agenda

---

## Step 0 — Primeiro contato (requer aprovacao do owner)

```
Oi {{first_name}}, tudo bem?

Vi que voce tem interesse em como o MedShare pode ajudar com {{main_pain}}.

Posso te mostrar como funciona na pratica? E rapido e sem compromisso.
```

**Placeholders:**
- `{{first_name}}` — primeiro nome do lead
- `{{main_pain}}` — dor principal identificada no cadastro

---

## Step 1 — Lembrete (+1 dia)

```
{{first_name}}, so passando para ver se minha mensagem chegou.

Se preferir, posso te mandar um video curto mostrando como funciona. Fica a vontade.
```

---

## Step 2 — Demo em video (+3 dias)

```
{{first_name}}, gravei um video de 3 minutos mostrando como o MedShare funciona para {{role}}.

[link]

Acho que vai fazer sentido para a sua rotina.
```

**Placeholders:**
- `{{role}}` — cargo/especialidade do lead

---

## Step 3 — Personalizacao pela dor (+7 dias)

```
{{first_name}}, uma coisa especifica que vi no seu perfil:

{{personalized_insight}}

O MedShare resolve isso de forma automatica. Quer ver como?
```

**Placeholders:**
- `{{personalized_insight}}` — insight gerado por LLM com base nas notas do lead

---

## Step 4 — Ultima tentativa (+14 dias)

```
{{first_name}}, vou deixar a porta aberta.

Quando fizer sentido, e so me chamar. Sem pressao.
```

---

## Regras de personalidade

- Nunca pressionar ou criar urgencia falsa
- Tom de colega de profissao, nao de vendedor
- Frases curtas, diretas
- Sem emojis excessivos
- Nunca mencionar preco sem ser perguntado
