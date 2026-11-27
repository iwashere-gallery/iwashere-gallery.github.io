CREATE TABLE download_events (event_key TEXT PRIMARY KEY NOT NULL, photo TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX download_photo ON download_events(photo);
--> statement-breakpoint
CREATE INDEX download_date ON download_events(created);
