import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "splitchai-pots",
      sql: `CREATE TABLE IF NOT EXISTS pots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  per_expense_cap INTEGER NOT NULL,
  daily_cap INTEGER NOT NULL,
  allowed_categories TEXT NOT NULL,
  approvals_required INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS pot_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS pot_members (
  id TEXT PRIMARY KEY,
  pot_id TEXT NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  pot_id TEXT NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  paid_by TEXT NOT NULL,
  split_mode TEXT NOT NULL DEFAULT 'equal',
  splits TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved','pending_approval','rejected','void')),
  approvals TEXT NOT NULL DEFAULT '[]',
  checks TEXT NOT NULL DEFAULT '[]',
  reasons TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'ui',
  spent_on TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  pot_id TEXT NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
  from_member TEXT NOT NULL,
  to_member TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT,
  source TEXT NOT NULL DEFAULT 'ui',
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS pot_activity (
  id TEXT PRIMARY KEY,
  pot_id TEXT NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS pots_owner_org_idx ON pots (owner_email, org_id, created_at);
CREATE INDEX IF NOT EXISTS pot_shares_resource_idx ON pot_shares (resource_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS pot_members_pot_idx ON pot_members (pot_id, created_at);
CREATE INDEX IF NOT EXISTS expenses_pot_idx ON expenses (pot_id, created_at);
CREATE INDEX IF NOT EXISTS expenses_pot_day_idx ON expenses (pot_id, spent_on, status);
CREATE INDEX IF NOT EXISTS settlements_pot_idx ON settlements (pot_id, created_at);
CREATE INDEX IF NOT EXISTS pot_activity_pot_idx ON pot_activity (pot_id, created_at)`,
    },
  ],
  { table: "splitchai_migrations" },
);
