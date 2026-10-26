CREATE TABLE IF NOT EXISTS ignored_digests(user_id TEXT NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(user_id, message_id));
