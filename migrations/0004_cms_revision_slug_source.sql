ALTER TABLE cms_post_revisions ADD COLUMN slug_source TEXT NOT NULL DEFAULT 'legacy_backfill';
