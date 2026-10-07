ALTER TABLE users ADD COLUMN mail_preferences TEXT NOT NULL DEFAULT '{"categories":[1,2,3,4],"daily":{"enabled":true,"time":"20:00"},"late":{"enabled":true,"time":"00:00"}}';
