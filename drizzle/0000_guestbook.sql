CREATE TABLE view_events (event_key TEXT PRIMARY KEY NOT NULL, photo TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX view_photo ON view_events(photo);
--> statement-breakpoint
CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, photo TEXT NOT NULL, nickname TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, guest TEXT NOT NULL, submission TEXT UNIQUE NOT NULL);
--> statement-breakpoint
CREATE INDEX message_photo ON messages(photo,id);
--> statement-breakpoint
CREATE INDEX message_guest ON messages(guest,created);
