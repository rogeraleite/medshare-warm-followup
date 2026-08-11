-- New status 'conversando' for leads actively engaged in back-and-forth conversation.
-- Also adds conversation_log: a running chronological text of all messages exchanged,
-- designed to be copied whole into another LLM for context.

ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('active', 'replied', 'conversando', 'converted', 'lost'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS conversation_log text;
COMMENT ON COLUMN referrals.status IS
  'active=sequência automática | replied=lead respondeu (1ª vez) | conversando=conversa ativa em andamento | converted=virou cliente | lost=sem resposta ou recusou';
COMMENT ON COLUMN referrals.conversation_log IS
  'Histórico cronológico da conversa — formato [DD/MM HH:MM] QUEM: mensagem. Pode ser copiado para LLMs externos.';
