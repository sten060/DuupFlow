-- User video templates
create table user_templates (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  ranges     jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Index for fast lookups by user
create index idx_user_templates_user_id on user_templates (user_id);

-- Enable row-level security
alter table user_templates enable row level security;

-- RLS policies: users can only access their own templates
create policy "Users can select their own templates"
  on user_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert their own templates"
  on user_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own templates"
  on user_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own templates"
  on user_templates for delete
  using (auth.uid() = user_id);
