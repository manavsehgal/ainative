-- Saved views: per-surface filter/sort/column/density configurations
CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY NOT NULL,
  surface TEXT NOT NULL,
  name TEXT NOT NULL,
  filters TEXT,
  sorting TEXT,
  columns TEXT,
  density TEXT DEFAULT 'comfortable',
  is_default INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_views_surface ON views(surface);
CREATE INDEX IF NOT EXISTS idx_views_surface_default ON views(surface, is_default);
