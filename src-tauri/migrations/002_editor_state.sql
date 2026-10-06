ALTER TABLE documents ADD COLUMN editor_state TEXT;
ALTER TABLE documents ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown';
