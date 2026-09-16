-- My Health Scanner — pre-launch site storage (Cloudflare D1)
-- Apply with:
--   npx wrangler d1 execute mhs-prelaunch --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  platform   TEXT,
  source     TEXT,
  ip_country TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers (created_at);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  topic      TEXT,
  message    TEXT NOT NULL,
  ip_country TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
