-- Standardize all live Celebration product names and image alt text.
-- Future catalog additions/edits should use the live DB admin path; no catalog deployment is required.
WITH name_map(product_id, product_name) AS (
  VALUES
    ('celebration-necklace-001','Korean Fan Crystal Pendant Necklace'),
    ('celebration-necklace-002','Korean Bow Crystal Pendant Necklace'),
    ('celebration-necklace-003','Korean Four Heart Convertible Pendant Necklace'),
    ('celebration-necklace-004','Korean Double Heart Crystal Pendant Necklace'),
    ('celebration-necklace-005','Korean Love Key Crystal Pendant Necklace'),
    ('celebration-necklace-006','Korean Square Dancing Stone Necklace'),
    ('celebration-necklace-007','Korean Crown Dancing Stone Necklace'),
    ('celebration-necklace-008','Korean Teardrop Dancing Stone Necklace'),
    ('celebration-necklace-009','Korean Heart Dancing Stone Necklace'),
    ('celebration-necklace-010','Korean Wave Dancing Stone Necklace'),
    ('celebration-necklace-011','Korean Gold Flower Dancing Stone Necklace'),
    ('celebration-necklace-012','Korean Teddy Bear Dancing Stone Necklace'),
    ('celebration-necklace-013','Korean Flower Dancing Stone Necklace'),
    ('celebration-necklace-014','Korean Moon Heart Dancing Stone Necklace'),
    ('celebration-necklace-015','Korean Pearl Flower Pendant Necklace'),
    ('celebration-necklace-016','Korean Rose Gold Teddy Bear Crystal Necklace'),
    ('celebration-necklace-017','Korean Gold Flower Medallion Necklace'),
    ('celebration-necklace-018','Korean Open Flower Crystal Pendant Necklace'),
    ('celebration-necklace-019','Korean Pearl Flower Halo Necklace'),
    ('celebration-necklace-020','Korean Twist Dancing Stone Necklace'),
    ('celebration-necklace-021','Korean Spiral Flower Crystal Necklace'),
    ('celebration-necklace-022','Korean Heart Halo Dancing Stone Necklace'),
    ('celebration-set-001','Korean Pearl Halo Crystal Necklace & Earrings Set'),
    ('celebration-set-002','Korean Cute Teddy Bear Crystal Necklace & Earrings Set'),
    ('celebration-set-003','Snap Ghost Crystal Necklace & Earrings Set'),
    ('celebration-set-004','Korean Blue Heart Butterfly Necklace & Earrings Set'),
    ('celebration-set-005','Korean Dolphin Crystal Necklace & Earrings Set'),
    ('celebration-set-006','Korean Trinity Heart Pearl Necklace & Earrings Set'),
    ('celebration-set-007','Korean Pink Love Crystal Necklace & Earrings Set'),
    ('celebration-set-008','Korean Mother-of-Pearl Bar Necklace & Earrings Set'),
    ('celebration-set-009','Korean Black Cat Crystal Necklace & Earrings Set'),
    ('celebration-set-010','Korean Mother-of-Pearl Dolphin Necklace & Earrings Set'),
    ('celebration-set-011','Korean Black Butterfly Crystal Necklace & Earrings Set'),
    ('celebration-set-012','Korean Pearl Crescent Crystal Necklace & Earrings Set'),
    ('celebration-set-013','Korean Butterfly Pearl Drop Necklace & Earrings Set'),
    ('celebration-set-014','Korean Blue-Eye Cat Crystal Necklace & Earrings Set'),
    ('celebration-set-015','Korean Eiffel Tower Pearl Necklace & Earrings Set'),
    ('celebration-necklace-023','Cute Korean Teddy Bear Pendant Necklace'),
    ('celebration-necklace-024','Korean Black Butterfly Drop Necklace'),
    ('celebration-necklace-025','Korean Crystal Butterfly Pendant Necklace'),
    ('celebration-necklace-026','Korean Four-Petal Flower Pendant Necklace'),
    ('celebration-necklace-027','Korean Pear Drop Crystal Pendant Necklace'),
    ('celebration-necklace-028','Korean Square Solitaire Pendant Necklace'),
    ('celebration-necklace-029','Korean Celestial Star Pendant Necklace'),
    ('celebration-necklace-030','Korean Dazzling Star Pendant Necklace – Silver'),
    ('celebration-necklace-031','Korean Dazzling Star Pendant Necklace – Sparkle'),
    ('celebration-necklace-032','Korean Dazzling Star Pendant Necklace – Minimal'),
    ('celebration-necklace-033','Korean Bow Ribbon Pendant Necklace'),
    ('celebration-necklace-034','Korean Butterfly Crystal Pendant Necklace'),
    ('celebration-necklace-035','Korean Clover Pendant Necklace'),
    ('celebration-necklace-036','Korean Emerald Butterfly Pendant Necklace'),
    ('celebration-necklace-037','Korean Hummingbird Crystal Pendant Necklace'),
    ('celebration-necklace-038','Korean Mermaid Pearl Pendant Necklace'),
    ('celebration-necklace-039','Korean Pearl Drop Pendant Necklace'),
    ('celebration-necklace-040','Korean Pearl Flower Pendant Necklace'),
    ('celebration-necklace-041','Korean Pink Crystal Pendant Necklace'),
    ('celebration-necklace-042','Korean Square Halo Crystal Pendant Necklace'),
    ('celebration-necklace-043','Korean Tulip Flower Pendant Necklace'),
    ('celebration-necklace-044','Korean Pink Stone Pendant Necklace'),
    ('celebration-necklace-045','Korean Butterfly Heart Pendant Necklace'),
    ('celebration-necklace-046','Korean Swan Pearl Pendant Necklace'),
    ('celebration-necklace-047','Korean Heartbeat Heart Pendant Necklace'),
    ('celebration-necklace-048','Korean Pink Star Pendant Necklace'),
    ('celebration-necklace-049','Korean Sunburst Crystal Pendant Necklace'),
    ('celebration-necklace-050','Korean Romantic Heart Crystal Pendant Necklace')
),
transformed AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           (
             SELECT jsonb_agg(
               CASE
                 WHEN nm.product_name IS NULL THEN p.product
                 ELSE jsonb_set(
                        jsonb_set(
                          p.product,
                          '{name}',
                          to_jsonb(nm.product_name),
                          true
                        ),
                        '{images}',
                        CASE
                          WHEN jsonb_typeof(p.product->'images') = 'array' THEN (
                            SELECT jsonb_agg(
                              jsonb_set(img.value, '{alt}', to_jsonb(nm.product_name), true)
                              ORDER BY img.ordinality
                            )
                            FROM jsonb_array_elements(p.product->'images') WITH ORDINALITY AS img(value, ordinality)
                          )
                          ELSE COALESCE(p.product->'images', '[]'::jsonb)
                        END,
                        true
                      )
               END
               ORDER BY p.ordinality
             )
             FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb))
                  WITH ORDINALITY AS p(product, ordinality)
             LEFT JOIN name_map nm ON nm.product_id = p.product->>'id'
           ),
           true
         ) AS payload
  FROM catalog_config cc
  WHERE cc.id = 'primary'
),
updated AS (
  UPDATE catalog_config cc
     SET payload = transformed.payload,
         version = cc.version + 1,
         updated_at = now()
    FROM transformed
   WHERE cc.id = transformed.id
  RETURNING cc.version, cc.payload
)
INSERT INTO catalog_revisions (version, payload)
SELECT version, payload FROM updated;

DELETE FROM catalog_drafts WHERE id = 'primary';
