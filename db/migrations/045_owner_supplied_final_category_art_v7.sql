-- Phase 1 final category rail: owner-supplied eight round editorial images.
-- New Earrings is a real navigation/filter option but has NO fabricated SKU.
ALTER TABLE home_category_media DROP CONSTRAINT IF EXISTS home_category_media_image_url_check;
ALTER TABLE home_category_media ADD CONSTRAINT home_category_media_image_url_check CHECK (
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v1%2F%.webp' OR
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v2%2F%.webp' OR
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v3%2F%.webp' OR
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v4%2F%.webp' OR
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v5%2F%.webp' OR
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v6%2F%.webp' OR
  image_url LIKE '/api/catalog/image?key=catalog%2Feditorial%2Fcategory-v7%2F%.webp'
);
