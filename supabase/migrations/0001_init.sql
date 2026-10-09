-- Adaptive AI schema: tables, indexes, constraints, RLS, storage, and auth trigger.
-- Apply in the Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Student'),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_subject_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.subjects s
    where s.id = new.subject_id and s.user_id = new.user_id
  ) then
    raise exception 'subject_id must belong to the same user';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_reminder_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.timetable_entries e
    where e.id = new.timetable_entry_id and e.user_id = new.user_id
  ) then
    raise exception 'timetable_entry_id must belong to the same user';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  student_id text,
  department text,
  semester integer,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  code text,
  teacher text,
  default_room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  room text,
  teacher text,
  semester text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_day_of_week_check check (day_of_week between 0 and 6),
  constraint timetable_time_order_check check (end_time > start_time)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  timetable_entry_id uuid not null references public.timetable_entries (id) on delete cascade,
  minutes_before integer not null,
  enabled boolean not null default true,
  notification_title text,
  notification_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_minutes_before_check check (minutes_before > 0)
);

create table if not exists public.timetable_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text,
  file_type text,
  processing_status text not null default 'pending',
  extracted_data jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_uploads_status_check check (
    processing_status in ('pending', 'processing', 'completed', 'failed')
  )
);

create table if not exists public.mcq_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text,
  question text,
  options jsonb,
  answer text,
  explanation text,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint ai_messages_role_check check (role in ('user', 'assistant', 'system'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists subjects_user_id_idx on public.subjects (user_id);
create index if not exists timetable_entries_user_id_idx on public.timetable_entries (user_id);
create index if not exists timetable_entries_subject_id_idx on public.timetable_entries (subject_id);
create index if not exists timetable_entries_day_idx on public.timetable_entries (day_of_week);
create index if not exists timetable_entries_user_day_idx on public.timetable_entries (user_id, day_of_week);
create index if not exists reminders_user_id_idx on public.reminders (user_id);
create index if not exists reminders_entry_id_idx on public.reminders (timetable_entry_id);
create index if not exists timetable_uploads_user_id_idx on public.timetable_uploads (user_id);
create index if not exists mcq_history_user_id_idx on public.mcq_history (user_id);
create index if not exists mcq_history_created_at_idx on public.mcq_history (created_at desc);
create index if not exists ai_conversations_user_id_idx on public.ai_conversations (user_id);
create index if not exists ai_messages_conversation_id_idx on public.ai_messages (conversation_id);
create index if not exists ai_messages_created_at_idx on public.ai_messages (created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at before update on public.subjects
for each row execute function public.set_updated_at();

drop trigger if exists timetable_entries_set_updated_at on public.timetable_entries;
create trigger timetable_entries_set_updated_at before update on public.timetable_entries
for each row execute function public.set_updated_at();

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at before update on public.reminders
for each row execute function public.set_updated_at();

drop trigger if exists timetable_uploads_set_updated_at on public.timetable_uploads;
create trigger timetable_uploads_set_updated_at before update on public.timetable_uploads
for each row execute function public.set_updated_at();

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

drop trigger if exists timetable_entries_subject_owner on public.timetable_entries;
create trigger timetable_entries_subject_owner
before insert or update on public.timetable_entries
for each row execute function public.enforce_subject_owner();

drop trigger if exists reminders_entry_owner on public.reminders;
create trigger reminders_entry_owner
before insert or update on public.reminders
for each row execute function public.enforce_reminder_owner();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.reminders enable row level security;
alter table public.timetable_uploads enable row level security;
alter table public.mcq_history enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles for delete using (id = auth.uid());

drop policy if exists subjects_all_own on public.subjects;
create policy subjects_all_own on public.subjects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists timetable_entries_all_own on public.timetable_entries;
create policy timetable_entries_all_own on public.timetable_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reminders_all_own on public.reminders;
create policy reminders_all_own on public.reminders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists timetable_uploads_all_own on public.timetable_uploads;
create policy timetable_uploads_all_own on public.timetable_uploads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mcq_history_all_own on public.mcq_history;
create policy mcq_history_all_own on public.mcq_history for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_conversations_all_own on public.ai_conversations;
create policy ai_conversations_all_own on public.ai_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_messages_all_own on public.ai_messages;
create policy ai_messages_all_own on public.ai_messages for all
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('profile-images', 'profile-images', false),
  ('timetable-files', 'timetable-files', false),
  ('mcq-images', 'mcq-images', false)
on conflict (id) do nothing;

drop policy if exists profile_images_own on storage.objects;
create policy profile_images_own on storage.objects for all
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists timetable_files_own on storage.objects;
create policy timetable_files_own on storage.objects for all
  using (bucket_id = 'timetable-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'timetable-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mcq_images_own on storage.objects;
create policy mcq_images_own on storage.objects for all
  using (bucket_id = 'mcq-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'mcq-images' and (storage.foldername(name))[1] = auth.uid()::text);
