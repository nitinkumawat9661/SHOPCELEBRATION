-- Home category editorial photography, distinct from exact-SKU product media.
-- Original photography is self-hosted in R2 as optimized WebP; SQL owns only
-- the asset URL, attribution and category mapping (not third-party hotlinks).
CREATE TABLE IF NOT EXISTS home_category_media (
  category_id text PRIMARY KEY,
  image_url text NOT NULL CHECK (image_url LIKE '/api/catalog/image?key=catalog/editorial/category-v1/%'),
  source_page text NOT NULL CHECK (source_page LIKE 'https://unsplash.com/photos/%'),
  photographer text NOT NULL,
  license_name text NOT NULL DEFAULT 'Unsplash License',
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
