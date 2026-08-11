-- Estado semanal da automacao editorial do MedShare Blog.
-- Mantido separado de leads e aprovacoes de posts do Instagram.

create table public.blog_editorial_cycles (
  id                   uuid primary key default gen_random_uuid(),
  week_start           date not null unique,
  selection_deadline   timestamptz not null,
  options              jsonb not null,
  selected_option      text,
  selection_source     text,
  selected_at          timestamptz,
  status               text not null default 'pending',
  monday_article       jsonb,
  thursday_article     jsonb,
  notification_sent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint blog_editorial_cycles_week_starts_monday
    check (extract(isodow from week_start) = 1),
  constraint blog_editorial_cycles_options_object
    check (jsonb_typeof(options) = 'object' and options ? 'D'),
  constraint blog_editorial_cycles_selected_option
    check (selected_option is null or selected_option in ('A', 'B', 'C', 'D')),
  constraint blog_editorial_cycles_selected_option_exists
    check (selected_option is null or options ? selected_option),
  constraint blog_editorial_cycles_selection_source
    check (selection_source is null or selection_source in ('owner', 'default')),
  constraint blog_editorial_cycles_selection_consistent
    check (
      (selected_option is null and selection_source is null and selected_at is null)
      or
      (selected_option is not null and selection_source is not null and selected_at is not null)
    ),
  constraint blog_editorial_cycles_status
    check (status in ('pending', 'locked', 'completed')),
  constraint blog_editorial_cycles_locked_has_selection
    check (status = 'pending' or selected_option is not null),
  constraint blog_editorial_cycles_monday_article
    check (monday_article is null or jsonb_typeof(monday_article) = 'object'),
  constraint blog_editorial_cycles_thursday_article
    check (thursday_article is null or jsonb_typeof(thursday_article) = 'object'),
  constraint blog_editorial_cycles_completed_notified
    check (status <> 'completed' or notification_sent_at is not null)
);

create index blog_editorial_cycles_pending_idx
  on public.blog_editorial_cycles (selection_deadline, week_start)
  where status = 'pending';

alter table public.blog_editorial_cycles enable row level security;
revoke all on table public.blog_editorial_cycles from anon, authenticated;
grant all on table public.blog_editorial_cycles to service_role;

create or replace function public.set_blog_editorial_cycles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_blog_editorial_cycles_updated_at
before update on public.blog_editorial_cycles
for each row execute function public.set_blog_editorial_cycles_updated_at();

create or replace function public.select_blog_editorial_option(p_option text)
returns setof public.blog_editorial_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_option text := upper(trim(p_option));
begin
  if normalized_option not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid blog editorial option';
  end if;

  return query
  with target as (
    select id
    from public.blog_editorial_cycles
    where status = 'pending'
      and selection_deadline > now()
      and options ? normalized_option
    order by week_start asc
    limit 1
    for update skip locked
  )
  update public.blog_editorial_cycles as cycle
  set selected_option = normalized_option,
      selection_source = 'owner',
      selected_at = now()
  from target
  where cycle.id = target.id
  returning cycle.*;
end;
$$;

create or replace function public.lock_blog_editorial_cycle(
  p_week_start date,
  p_selection_deadline timestamptz,
  p_default_direction text
)
returns setof public.blog_editorial_cycles
language plpgsql
security definer
set search_path = public
as $$
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday';
  end if;

  if nullif(trim(p_default_direction), '') is null then
    raise exception 'default direction must not be empty';
  end if;

  insert into public.blog_editorial_cycles (
    week_start,
    selection_deadline,
    options,
    selected_option,
    selection_source,
    selected_at,
    status
  )
  values (
    p_week_start,
    p_selection_deadline,
    jsonb_build_object('D', trim(p_default_direction)),
    'D',
    'default',
    now(),
    'locked'
  )
  on conflict (week_start) do nothing;

  return query
  update public.blog_editorial_cycles as cycle
  set selected_option = coalesce(cycle.selected_option, 'D'),
      selection_source = coalesce(cycle.selection_source, 'default'),
      selected_at = coalesce(cycle.selected_at, now()),
      status = 'locked'
  where cycle.week_start = p_week_start
    and cycle.status in ('pending', 'locked')
  returning cycle.*;
end;
$$;

revoke all on function public.select_blog_editorial_option(text) from public, anon, authenticated;
grant execute on function public.select_blog_editorial_option(text) to service_role;

revoke all on function public.lock_blog_editorial_cycle(date, timestamptz, text) from public, anon, authenticated;
grant execute on function public.lock_blog_editorial_cycle(date, timestamptz, text) to service_role;
