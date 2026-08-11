-- Add reply context fields to referrals table
-- Enables the reply-chat workflow: owner pastes a lead's response,
-- AI analyzes it and suggests the next message, context is persisted.

ALTER TABLE referrals
  ADD COLUMN last_reply_text    text,
  ADD COLUMN last_reply_at      timestamptz,
  ADD COLUMN confirmed_pain     text,
  ADD COLUMN conversation_goal  text CHECK (conversation_goal IN ('demo', 'nurture', 'objection_handling', 'close')),
  ADD COLUMN conversation_notes text;
COMMENT ON COLUMN referrals.last_reply_text    IS 'Último texto colado pelo owner com a resposta do lead';
COMMENT ON COLUMN referrals.last_reply_at      IS 'Quando a resposta foi registrada';
COMMENT ON COLUMN referrals.confirmed_pain     IS 'Dor confirmada pelo lead na conversa';
COMMENT ON COLUMN referrals.conversation_goal  IS 'Objetivo da próxima mensagem: demo | nurture | objection_handling | close';
COMMENT ON COLUMN referrals.conversation_notes IS 'Notas livres sobre o diálogo em andamento';
