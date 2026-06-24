-- Named lists (buckets): «Общее»/«Тата»/«Максим». A product-level catalogue the
-- user switches between via tabs, orthogonal to the active/archived session split
-- below. Seeded by store._migrate; editable via UI in the future.
CREATE TABLE IF NOT EXISTS named_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- A list "session": exactly one 'active' plus any number of 'archived' snapshots.
-- named_list_id tags which bucket an archived snapshot was bought from.
CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK (status IN ('active','archived')),
    created_at INTEGER NOT NULL,
    archived_at INTEGER,
    named_list_id INTEGER REFERENCES named_lists(id)
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
    position INTEGER NOT NULL,
    category TEXT,
    named_list_id INTEGER REFERENCES named_lists(id)
);

CREATE INDEX IF NOT EXISTS items_list_idx ON items(list_id, position);
CREATE INDEX IF NOT EXISTS lists_status_idx ON lists(status);
-- items_named_list_idx is created in store._migrate, after the named_list_id
-- column is guaranteed to exist (legacy items tables predate it).

CREATE TABLE IF NOT EXISTS ingest_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('text','voice','photo')),
    stage TEXT NOT NULL CHECK (stage IN ('listening','transcribing','parsing','success','error')),
    title TEXT,
    sub TEXT,
    added_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS ingest_user_active_idx
    ON ingest_events(user_id, finished_at, updated_at);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
