CREATE TABLE meeting_polls (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 15,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open','confirmed','closed')),
  confirmed_start INTEGER,
  confirmed_end INTEGER,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX meeting_polls_group ON meeting_polls(group_id, status, created);

CREATE TABLE meeting_availability (
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  intervals TEXT NOT NULL,
  avoid_intervals TEXT NOT NULL DEFAULT '[]',
  updated INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX meeting_availability_user ON meeting_availability(user_id, updated);
