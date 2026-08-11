drop policy if exists "service role full access" on content_runs;
revoke all on table content_runs from anon, authenticated;
grant all on table content_runs to service_role;
create policy "service role full access" on content_runs
  to service_role
  using (true)
  with check (true);
