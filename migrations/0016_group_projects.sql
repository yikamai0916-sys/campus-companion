CREATE TABLE group_projects(id TEXT PRIMARY KEY,group_id TEXT NOT NULL,title TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL);
ALTER TABLE task_candidates ADD COLUMN project_id TEXT;
CREATE TABLE task_applications(candidate_id TEXT NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,PRIMARY KEY(candidate_id,user_id));
CREATE TABLE group_notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,group_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,seen INTEGER NOT NULL DEFAULT 0);
CREATE INDEX group_notifications_user ON group_notifications(user_id,created);
