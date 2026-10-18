-- Preferred Chinese rendering of the account holder's name (简/繁 UI only).
ALTER TABLE users ADD COLUMN preferred_zh_name TEXT NOT NULL DEFAULT '';
