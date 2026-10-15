-- Accounts: a workspace name is a username with a password, so the owner can
-- log in from any device.

-- scrypt hash, "scrypt$N$r$p$salt$hash" (base64). Null for accounts created
-- before passwords; their owner sets one from the original device.
alter table workspaces add column if not exists password_hash text;

-- One row per logged-in device. The cookie holds a random token; only its
-- SHA-256 is stored, so a database leak does not reveal live sessions.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_workspace_idx on sessions (workspace_id);
alter table sessions enable row level security;
