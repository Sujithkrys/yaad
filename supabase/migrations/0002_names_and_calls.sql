-- Named workspaces: each visitor picks a unique name on first visit.
alter table workspaces add column if not exists name text
  check (name is null or char_length(name) between 2 and 40);
create unique index if not exists workspaces_name_key on workspaces (lower(name));

-- Sarvam outbound calls.
alter table calls add column if not exists failure_reason text;
alter table calls add column if not exists response_note text;
alter table calls add column if not exists next_attempt_at timestamptz;

create table if not exists call_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  call_id uuid not null references calls(id) on delete cascade,
  attempt_no int not null,
  sarvam_attempt_id text unique,
  status text not null default 'dialing' check (status in ('dialing','connected','no_answer','busy','failed')),
  response text, duration_sec numeric, interaction_id text, failure_reason text,
  payload jsonb, created_at timestamptz not null default now(), finished_at timestamptz
);
create index if not exists call_attempts_call_id_idx on call_attempts (call_id);
create index if not exists call_attempts_created_idx on call_attempts (created_at desc);
alter table call_attempts enable row level security;

-- Family alerts. Written now; delivery (WhatsApp/SMS via QStash) comes later.
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  call_id uuid references calls(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  kind text not null check (kind in ('missed','unwell')),
  message text not null,
  channel text,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_workspace_idx on alerts (workspace_id, created_at desc);
alter table alerts enable row level security;
