-- Cloud sync schema for Abu Oreibан / Shubat Al-Awda
-- Apply this schema to the remote D1 database "mood".

CREATE TABLE IF NOT EXISTS sync_records (
  record_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id TEXT NOT NULL UNIQUE,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert','delete')),
  data_json TEXT,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_seq ON sync_changes(seq);
CREATE INDEX IF NOT EXISTS idx_sync_changes_record ON sync_changes(record_id);
CREATE INDEX IF NOT EXISTS idx_sync_records_updated ON sync_records(updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_records_deleted ON sync_records(deleted);
