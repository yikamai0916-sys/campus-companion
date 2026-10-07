-- Remove global business-key constraints introduced before multi-account support.
-- Record IDs from external mail providers may legitimately repeat across users.
CREATE TABLE tasks_scoped (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due INTEGER,
  priority INTEGER NOT NULL DEFAULT 2,
  completed INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  reminders TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  user_id TEXT
);
INSERT INTO tasks_scoped SELECT id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_scoped RENAME TO tasks;
CREATE INDEX tasks_due ON tasks(completed, due);
CREATE INDEX tasks_user_due ON tasks(user_id, completed, due);
CREATE UNIQUE INDEX tasks_user_source ON tasks(user_id, source_id) WHERE user_id IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE messages_scoped (
  id TEXT NOT NULL,
  subject TEXT NOT NULL,
  received INTEGER NOT NULL,
  sender TEXT NOT NULL,
  origin TEXT NOT NULL,
  category INTEGER NOT NULL,
  summary TEXT NOT NULL,
  action TEXT NOT NULL,
  url TEXT NOT NULL,
  quality TEXT NOT NULL,
  user_id TEXT,
  PRIMARY KEY (user_id, id)
);
INSERT INTO messages_scoped SELECT id,subject,received,sender,origin,category,summary,action,url,quality,user_id FROM messages;
DROP TABLE messages;
ALTER TABLE messages_scoped RENAME TO messages;
CREATE INDEX messages_received ON messages(received);
CREATE INDEX messages_user_received ON messages(user_id, received);

CREATE TABLE message_localizations_scoped (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  subject TEXT NOT NULL,
  sender TEXT NOT NULL,
  origin TEXT NOT NULL,
  summary TEXT NOT NULL,
  action TEXT NOT NULL,
  quality TEXT NOT NULL,
  updated INTEGER NOT NULL,
  cache_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, message_id, locale)
);
INSERT INTO message_localizations_scoped SELECT message_id,user_id,locale,subject,sender,origin,summary,action,quality,updated,cache_version FROM message_localizations;
DROP TABLE message_localizations;
ALTER TABLE message_localizations_scoped RENAME TO message_localizations;
CREATE INDEX message_localizations_user_locale ON message_localizations(user_id, locale);
