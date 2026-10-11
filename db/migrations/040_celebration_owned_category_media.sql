-- The navigation's category photos now derive from original Celebration
-- product media, not Unsplash. Preserve existing R2 v1 keys until v2 rollout.
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_image_url_check;
ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_image_url_check
  CHECK (
    image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v1%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v2%2F%.webp'
  );
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_source_page_check;
ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_source_page_check
  CHECK (
    source_page LIKE 'https://unsplash.com/photos/%'
    OR source_page LIKE 'https://shopcelebration.in/jewelry/%'
  );
