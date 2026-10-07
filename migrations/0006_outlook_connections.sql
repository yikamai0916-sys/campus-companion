CREATE TABLE IF NOT EXISTS outlook_connections (
  user_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '已连接，等待首次同步',
  cursor TEXT,
  cutoff TEXT,
  since TEXT,
  last_sync INTEGER,
  last_attempt INTEGER
);
CREATE INDEX IF NOT EXISTS outlook_connections_last_attempt ON outlook_connections(last_attempt);
