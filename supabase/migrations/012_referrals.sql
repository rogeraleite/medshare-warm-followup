-- Referrals: leads indicated by current users or contacts
-- Manual follow-up via owner's personal WhatsApp (no API sending)

CREATE TABLE referrals (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referred_name     text NOT NULL,
  referred_phone    text,
  referred_role     text,
  notes             text,
  referrer_name     text NOT NULL,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'replied', 'converted', 'lost')),
  current_step      integer NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 2),
  step_sent_at      timestamptz,
  next_followup_at  date NOT NULL DEFAULT CURRENT_DATE,
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Efficient daily "who do I follow up with today?" query
CREATE INDEX idx_referrals_due
  ON referrals (next_followup_at, status)
  WHERE status = 'active';
COMMENT ON TABLE referrals IS 'Leads indicados por usuários ou contatos do MedShare. Acompanhamento manual via WhatsApp pessoal do owner.';
COMMENT ON COLUMN referrals.current_step IS '0=primeiro contato, 1=follow-up dia 4, 2=última tentativa dia 14';
COMMENT ON COLUMN referrals.status IS 'active=sequência em andamento | replied=respondeu | converted=virou cliente | lost=sem resposta ou recusou';
