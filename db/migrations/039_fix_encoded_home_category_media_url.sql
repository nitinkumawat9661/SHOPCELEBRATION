-- The URL uses encodeURIComponent: catalog/editorial/... becomes
-- catalog%2Feditorial%2F... . The earlier check expected raw slashes.
-- Migration 038 may already exist after an aborted (safe) deploy.
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_image_url_check;
ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_image_url_check
  CHECK (image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v1%2F%.webp');
