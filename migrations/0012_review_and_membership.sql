CREATE TABLE group_invitations (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, user_id TEXT NOT NULL,
 invited_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created INTEGER NOT NULL, UNIQUE(group_id,user_id)
);
CREATE INDEX invitations_user ON group_invitations(user_id,status);
CREATE TABLE mail_suggestions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, message_id TEXT NOT NULL,
 title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', due INTEGER, evidence TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
 created INTEGER NOT NULL, UNIQUE(user_id,message_id)
);
ALTER TABLE meeting_polls ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
