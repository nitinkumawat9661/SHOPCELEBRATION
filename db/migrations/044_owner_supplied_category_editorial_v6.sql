-- Seven category navigation photos hand-selected and supplied by store owner.
-- These are editorial category illustrations, NOT exact SKU listing media.
-- Keep v1-v5 for rollback; only update category media pointers.
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_image_url_check;
ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_image_url_check
  CHECK (
    image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v1%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v2%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v3%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v4%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v5%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v6%2F%.webp'
  );
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_source_page_check;
ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_source_page_check
  CHECK (
    source_page LIKE 'https://unsplash.com/photos/%'
    OR source_page LIKE 'https://shopcelebration.in/jewelry/%'
    OR source_page LIKE 'owner-provided:2026-10-12%'
  );
