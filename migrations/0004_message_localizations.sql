CREATE TABLE IF NOT EXISTS message_localizations (
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
  PRIMARY KEY (message_id, locale)
);
CREATE INDEX IF NOT EXISTS message_localizations_user_locale ON message_localizations(user_id, locale);
