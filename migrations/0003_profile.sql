ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN linked_email TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'zh-CN';
ALTER TABLE users ADD COLUMN reminder_defaults TEXT NOT NULL DEFAULT '{"offsets":[4320,1440,120,30],"repeat":1440,"start":"08:00","end":"23:00","days":[1,2,3,4,5,6,0],"push":true,"email":true}';
