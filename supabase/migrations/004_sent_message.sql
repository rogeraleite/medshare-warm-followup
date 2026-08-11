alter table instagram_leads
  add column if not exists sent_message_type text check (sent_message_type in ('short', 'full', 'none')),
  add column if not exists sent_message_text text;
