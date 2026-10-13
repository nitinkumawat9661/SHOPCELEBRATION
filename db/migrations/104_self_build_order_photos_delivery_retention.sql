-- Phase 3.8: PRIVATE Self-Build order photo ownership and delivery+48h retention.
-- This is a metadata-only, additive migration: checkout/customer_enabled stays OFF.
-- R2 objects remain encrypted/private at existing self-build/private/<draft>/<id>.webp.
-- Transfer of metadata from drafts is an ATOMIC part of future staged checkout.
-- Never cascade-delete order photo metadata: physical R2 removal must succeed first.
CREATE TABLE self_build_order_photos (
  id uuid PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  source_draft_id text NOT NULL,
  object_key text UNIQUE CHECK (
    object_key IS NULL OR
    object_key ~ '^self-build/private/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  ),
  image_bytes integer NOT NULL CHECK (image_bytes BETWEEN 1 AND 3145728),
  transferred_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT self_build_order_photo_deletion_state CHECK (
    (deleted_at IS NULL AND object_key IS NOT NULL)
    OR (deleted_at IS NOT NULL AND object_key IS NULL)
  )
);
CREATE INDEX self_build_order_photos_active_idx
 ON self_build_order_photos (order_id, transferred_at) WHERE deleted_at IS NULL;
COMMENT ON TABLE self_build_order_photos IS
  'Private paid Self-Build photos; R2 object deleted only after order status=delivered and delivered_at+48h. Draft source rows atomically detached.';
