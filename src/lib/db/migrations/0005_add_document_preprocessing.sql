-- Add preprocessing columns to documents table
ALTER TABLE documents ADD COLUMN extracted_text TEXT;
--> statement-breakpoint
ALTER TABLE documents ADD COLUMN processed_path TEXT;
--> statement-breakpoint
ALTER TABLE documents ADD COLUMN processing_error TEXT;
