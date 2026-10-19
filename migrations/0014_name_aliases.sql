-- Custom name aliases: the account holder maps their name variants
-- (e.g. "MA Yikai", "mayikai", "Yikai Ma") to a preferred Chinese name.
-- The alias match is case/order/spacing-insensitive at runtime.
CREATE TABLE name_aliases(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  zh_name TEXT NOT NULL,
  created INTEGER NOT NULL,
  UNIQUE(user_id, alias COLLATE NOCASE)
);
CREATE INDEX idx_name_aliases_user ON name_aliases(user_id);
