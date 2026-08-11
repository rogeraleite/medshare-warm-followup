-- Outbound AI Agent: extends instagram_leads with scoring, analysis and conversation tracking.
-- All columns are additive (ALTER TABLE only) — no existing queries break.

ALTER TABLE instagram_leads
  ADD COLUMN IF NOT EXISTS discovery_source        text,
  ADD COLUMN IF NOT EXISTS icp_score               integer,
  ADD COLUMN IF NOT EXISTS icp_summary             text,
  ADD COLUMN IF NOT EXISTS inferred_pains          jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS comm_tone               text,
  ADD COLUMN IF NOT EXISTS followup_1              text,
  ADD COLUMN IF NOT EXISTS followup_2              text,
  ADD COLUMN IF NOT EXISTS reply_text              text,
  ADD COLUMN IF NOT EXISTS objection_category      text,
  ADD COLUMN IF NOT EXISTS lead_stage              text,
  ADD COLUMN IF NOT EXISTS next_response_suggestion text;
-- Extend status check to include 'candidate' (auto-discovered, pending human review).
ALTER TABLE instagram_leads DROP CONSTRAINT IF EXISTS instagram_leads_status_check;
ALTER TABLE instagram_leads ADD CONSTRAINT instagram_leads_status_check
  CHECK (status IN ('candidate', 'new', 'message_sent', 'replied', 'converted'));
ALTER TABLE instagram_leads ADD CONSTRAINT instagram_leads_objection_category_check
  CHECK (objection_category IN (
    'planilha', 'whatsapp', 'grupo_resistente', 'sem_tempo',
    'sem_interesse_agora', 'custo', 'ja_possui_sistema', 'outros'
  ) OR objection_category IS NULL);
ALTER TABLE instagram_leads ADD CONSTRAINT instagram_leads_lead_stage_check
  CHECK (lead_stage IN (
    'curiosidade', 'interessado', 'objecao',
    'pronto_para_demo', 'fechando', 'perdido'
  ) OR lead_stage IS NULL);
CREATE INDEX IF NOT EXISTS idx_instagram_leads_candidates
  ON instagram_leads (icp_score DESC, created_at DESC)
  WHERE status = 'candidate';
COMMENT ON COLUMN instagram_leads.status IS
  'candidate=descoberto pelo agente outbound, aguardando revisão humana | new=lead aceito pelo humano | message_sent | replied | converted';
COMMENT ON COLUMN instagram_leads.discovery_source IS
  'Formato strategy:term — ex: hashtag:anestesiologia, location:hospital_copa_dor, search:anestesiologista';
COMMENT ON COLUMN instagram_leads.icp_score IS
  '0–100: fit com o ICP MedShare, calculado pelo screener Claude Haiku';
COMMENT ON COLUMN instagram_leads.inferred_pains IS
  'Array de strings com dores operacionais inferidas da bio + posts';
COMMENT ON COLUMN instagram_leads.objection_category IS
  'planilha|whatsapp|grupo_resistente|sem_tempo|sem_interesse_agora|custo|ja_possui_sistema|outros';
COMMENT ON COLUMN instagram_leads.lead_stage IS
  'curiosidade|interessado|objecao|pronto_para_demo|fechando|perdido';
