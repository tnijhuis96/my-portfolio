ALTER TABLE cms_post_revisions ADD COLUMN slug TEXT NOT NULL DEFAULT '';

UPDATE cms_post_revisions
SET slug = COALESCE((
  SELECT cms_posts.slug
  FROM cms_posts
  WHERE cms_posts.id = cms_post_revisions.post_id
    AND cms_posts.deleted_at IS NULL
), '')
WHERE slug = '';
