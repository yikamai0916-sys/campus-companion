ALTER TABLE messages ADD COLUMN cache_generation TEXT NOT NULL DEFAULT '';
UPDATE messages SET cache_generation=lower(hex(randomblob(16)));
CREATE TRIGGER messages_cache_generation AFTER INSERT ON messages
BEGIN
 UPDATE messages SET cache_generation=lower(hex(randomblob(16))) WHERE user_id=NEW.user_id AND id=NEW.id;
END;
CREATE TRIGGER messages_cache_revision AFTER UPDATE OF subject,summary,action,sender,origin,quality ON messages
WHEN OLD.subject!=NEW.subject OR OLD.summary!=NEW.summary OR OLD.action!=NEW.action OR OLD.sender!=NEW.sender OR OLD.origin!=NEW.origin OR OLD.quality!=NEW.quality
BEGIN
 UPDATE messages SET cache_generation=lower(hex(randomblob(16))) WHERE user_id=NEW.user_id AND id=NEW.id;
 DELETE FROM mail_cache WHERE user_id=NEW.user_id AND message_id=NEW.id;
 DELETE FROM message_localizations WHERE user_id=NEW.user_id AND message_id=NEW.id;
END;
CREATE TABLE mail_cache (
 user_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 generation TEXT NOT NULL,
 kind TEXT NOT NULL,
 locale TEXT NOT NULL,
 variant TEXT NOT NULL,
 value TEXT NOT NULL,
 created INTEGER NOT NULL,
 expires INTEGER NOT NULL,
 PRIMARY KEY(user_id,message_id,kind,locale,variant)
);
CREATE INDEX mail_cache_expiry ON mail_cache(expires);
CREATE TRIGGER messages_delete_derived AFTER DELETE ON messages
BEGIN
 DELETE FROM mail_cache WHERE user_id=OLD.user_id AND message_id=OLD.id;
 DELETE FROM message_localizations WHERE user_id=OLD.user_id AND message_id=OLD.id;
 DELETE FROM mail_suggestions WHERE user_id=OLD.user_id AND message_id=OLD.id;
END;

CREATE TABLE legacy_mail_cache_expiry (key TEXT PRIMARY KEY, expires INTEGER NOT NULL);
INSERT INTO legacy_mail_cache_expiry SELECT key,unixepoch()*1000+604800000 FROM kv WHERE key GLOB 'fulltrans:*' AND key!='fulltrans:cooldown';
