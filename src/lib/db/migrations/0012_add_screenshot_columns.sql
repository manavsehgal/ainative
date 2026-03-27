ALTER TABLE documents ADD COLUMN source TEXT DEFAULT 'upload';
ALTER TABLE documents ADD COLUMN conversation_id TEXT REFERENCES conversations(id);
ALTER TABLE documents ADD COLUMN message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
