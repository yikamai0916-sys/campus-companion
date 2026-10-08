ALTER TABLE tasks ADD COLUMN group_id TEXT;
ALTER TABLE tasks ADD COLUMN assigned_by TEXT;
ALTER TABLE tasks ADD COLUMN acceptance_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE tasks ADD COLUMN candidate_id TEXT;

CREATE UNIQUE INDEX tasks_candidate ON tasks(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX tasks_group ON tasks(group_id, completed, due);
CREATE INDEX tasks_assignee_status ON tasks(user_id, acceptance_status, completed, due);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','member')),
  joined INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user ON group_members(user_id, joined);

CREATE TABLE task_candidates (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  proposed_assignee_id TEXT,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due INTEGER,
  evidence TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','rejected')),
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX task_candidates_group_status ON task_candidates(group_id, status, created);

-- Outlook is read-only in MVP v1. Do not keep retrying jobs that require the
-- removed Mail.Send permission.
UPDATE jobs SET state='cancelled', error='邮件发送权限已停用' WHERE channel='email' AND state IN ('pending','sending');
