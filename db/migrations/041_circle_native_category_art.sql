-- Transition the seven owner-requested round category thumbnails from
-- rectangular v2 artwork to single-product, circle-masked v3 WebPs.
-- Allow old URLs until they are replaced. Never edit sale-product media.
ALTER TABLE home_category_media
  DROP CONSTRAINT IF EXISTS home_category_media_image_url_check;

ALTER TABLE home_category_media
  ADD CONSTRAINT home_category_media_image_url_check
  CHECK (
    image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v1%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v2%2F%.webp'
    OR image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v3%2F%.webp'
  );
