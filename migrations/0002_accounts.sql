CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  security_question TEXT,
  security_answer_hash TEXT,
  created INTEGER NOT NULL
);

ALTER TABLE sessions ADD COLUMN user_id TEXT;
ALTER TABLE tasks ADD COLUMN user_id TEXT;
ALTER TABLE messages ADD COLUMN user_id TEXT;
ALTER TABLE subscriptions ADD COLUMN user_id TEXT;
ALTER TABLE jobs ADD COLUMN user_id TEXT;
ALTER TABLE oauth ADD COLUMN user_id TEXT;

CREATE INDEX sessions_user ON sessions(user_id, expires);
CREATE INDEX tasks_user_due ON tasks(user_id, completed, due);
CREATE INDEX messages_user_received ON messages(user_id, received);
CREATE INDEX subscriptions_user ON subscriptions(user_id);
CREATE INDEX jobs_user_due ON jobs(user_id, state, at);
