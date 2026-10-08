ALTER TABLE meeting_polls ADD COLUMN phase TEXT NOT NULL DEFAULT 'collecting';
ALTER TABLE meeting_polls ADD COLUMN proposal_options TEXT NOT NULL DEFAULT '[]';
ALTER TABLE meeting_polls ADD COLUMN eligible_user_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE meeting_polls ADD COLUMN confirmation_token TEXT;

UPDATE meeting_polls SET phase='confirmed' WHERE status='confirmed';

CREATE TABLE meeting_votes (
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  proposal_start INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX meeting_votes_poll_start ON meeting_votes(poll_id, proposal_start);

CREATE TABLE group_announcements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_id TEXT,
  created_by TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX group_announcements_group ON group_announcements(group_id, created DESC);
CREATE UNIQUE INDEX group_announcements_source ON group_announcements(kind, source_id) WHERE source_id IS NOT NULL;
