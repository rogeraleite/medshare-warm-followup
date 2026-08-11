alter table content_runs
add column if not exists input jsonb;
