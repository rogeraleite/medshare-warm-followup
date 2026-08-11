create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  instagram_handle text not null unique,
  full_name text,
  bio text,
  followers integer,
  category text,
  external_url text,
  profile_pic_url text,
  is_verified boolean default false,
  is_business boolean default false,
  generated_message text,
  status text default 'new' check (status in ('new', 'message_sent', 'replied', 'converted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
