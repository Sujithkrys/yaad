-- Yaad schema. Row level security is on with no policies: the anon key can
-- read nothing; only the server, using the secret key, can access data.

create extension if not exists pgcrypto;

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  relation text not null default 'Other',
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  lang text not null check (lang in ('hi-IN','te-IN','ta-IN','kn-IN','en-IN')),
  consent text not null default 'pending' check (consent in ('pending','granted')),
  created_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  reminder_text text not null check (char_length(reminder_text) between 1 and 60),
  kind text not null default 'tablet' check (kind in ('tablet','walk','visit','other')),
  time_of_day text not null check (time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  repeat_rule text not null default 'daily' check (repeat_rule in ('daily','weekdays','once')),
  once_day date,
  active boolean not null default true,
  lang text check (lang in ('hi-IN','te-IN','ta-IN','kn-IN','en-IN')),
  created_at timestamptz not null default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  reminder_id uuid references reminders(id) on delete set null,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null,
  reminder_text text not null,
  lang text not null,
  scheduled_at timestamptz not null,
  status text not null default 'calling' check (status in ('calling','retry','confirmed','missed')),
  attempt int not null default 1,
  response text check (response in ('taken','later','not_taken','no_answer','unclear')),
  later_min int,
  duration_sec int,
  lines jsonb not null default '[]'::jsonb,
  alerted boolean not null default false,
  manual boolean not null default false,
  done_at timestamptz,
  sarvam_attempt_id text unique,
  sarvam_interaction_id text,
  created_at timestamptz not null default now()
);

create table settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  alert boolean not null default true,
  alert_channel text not null default 'WhatsApp' check (alert_channel in ('WhatsApp','SMS')),
  alert_number text not null default '',
  retry_min int not null default 10 check (retry_min in (5,10,15)),
  max_attempts int not null default 2 check (max_attempts between 1 and 3),
  quiet_on boolean not null default true,
  quiet_from text not null default '22:00',
  quiet_to text not null default '06:00',
  default_lang text not null default 'hi-IN',
  demo_outcome text not null default 'random' check (demo_outcome in ('random','taken','noanswer'))
);

create index on people (workspace_id);
create index on reminders (workspace_id);
create index on calls (workspace_id, scheduled_at desc);
-- one scheduled call per reminder per time slot, so the scheduler can never double-call
create unique index calls_reminder_slot on calls (reminder_id, scheduled_at) where manual = false;

alter table workspaces enable row level security;
alter table people enable row level security;
alter table reminders enable row level security;
alter table calls enable row level security;
alter table settings enable row level security;
