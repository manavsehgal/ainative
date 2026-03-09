-- Add preprocessing columns to documents table
ALTER TABLE documents ADD COLUMN extracted_text TEXT;
ALTER TABLE documents ADD COLUMN processed_path TEXT;
ALTER TABLE documents ADD COLUMN processing_error TEXT;
