CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK (status IN ('active','archived')),
    created_at INTEGER NOT NULL,
    archived_at INTEGER
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    qty TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    added_by INTEGER NOT NULL,
    added_at INTEGER NOT NULL,
    checked_by INTEGER,
    checked_at INTEGER,
    position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS items_list_idx ON items(list_id, position);
CREATE INDEX IF NOT EXISTS lists_status_idx ON lists(status);
