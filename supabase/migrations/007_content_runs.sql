create table if not exists content_runs (
  id          uuid primary key default gen_random_uuid(),
  squad       text not null,
  status      text not null default 'running',
  step        jsonb,
  checkpoint  jsonb,
  response    text,
  output_dir  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists content_runs_status_created_at_idx on content_runs (status, created_at desc);
alter table content_runs enable row level security;
do $$ begin
  create policy "service role full access" on content_runs
    using (true)
    with check (true);
exception when duplicate_object then null;
end $$;
create or replace function update_content_runs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create or replace trigger content_runs_updated_at
  before update on content_runs
  for each row execute function update_content_runs_updated_at();
