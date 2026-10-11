-- Media keys are URL-encoded by encodeURIComponent, so the SQL check must
-- validate the encoded self-hosted R2 path, not the decoded logical object key.
-- Migration 038 may already exist on VPS after a safe aborted release.
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_image_url_check;
ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_image_url_check
  CHECK (image_url ~ '^/api/catalog/image\\?key=catalog%2Feditorial%2Fcategory-v1%2F[a-z-]+\\.webp$');
