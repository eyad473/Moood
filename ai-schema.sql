-- Additive migration only; does not modify existing family, fund, or support tables.
CREATE TABLE IF NOT EXISTS ai_knowledge (
 id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL,
 content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft'
 CHECK(status IN ('draft','review','published','archived')),
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','admin')),
 valid_from INTEGER, valid_until INTEGER, created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL, approved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_public ON ai_knowledge(status,visibility,valid_until);
CREATE TABLE IF NOT EXISTS ai_conversations (
 id TEXT PRIMARY KEY, family_id TEXT NOT NULL, created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_family ON ai_conversations(family_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS ai_messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL
 CHECK(role IN ('user','assistant')), content TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id)
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS ai_audit_logs (
 id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_ref TEXT,
 action TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
