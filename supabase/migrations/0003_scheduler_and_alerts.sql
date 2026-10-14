-- Scheduler (QStash tick), retries and family alerts.

-- Materialised calls start as 'scheduled'.
alter table calls drop constraint if exists calls_status_check;
alter table calls add constraint calls_status_check
  check (status in ('scheduled','calling','retry','confirmed','missed'));

-- The webhook's unwell flag, so alerts can be sent once by the scheduler.
alter table calls add column if not exists unwell boolean not null default false;

-- ON CONFLICT needs a non-partial unique index. Manual calls use the exact
-- press time as scheduled_at, so they never collide with reminder slots.
drop index if exists calls_reminder_slot;
create unique index if not exists calls_reminder_slot on calls (reminder_id, scheduled_at);
create index if not exists calls_due_idx on calls (status, scheduled_at) where status in ('scheduled','retry');
create index if not exists calls_alert_idx on calls (alerted, done_at) where alerted = false;
create index if not exists call_attempts_dialing_idx on call_attempts (status, created_at) where status = 'dialing';

-- Sample family members (from "Load sample data") are never dialled for real.
alter table people add column if not exists is_sample boolean not null default false;
update people set is_sample = true where phone like '98765000%';

-- Email alerts.
alter table settings add column if not exists alert_email text not null default '';
alter table settings drop constraint if exists settings_alert_channel_check;
alter table settings add constraint settings_alert_channel_check check (alert_channel in ('WhatsApp','SMS','Email'));

-- In-app alert feed.
alter table alerts drop constraint if exists alerts_kind_check;
alter table alerts add constraint alerts_kind_check check (kind in ('missed','unwell','info'));
alter table alerts add column if not exists read_at timestamptz;

-- Small key-value store for operational state, e.g. the last scheduler tick.
create table if not exists app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_state enable row level security;
