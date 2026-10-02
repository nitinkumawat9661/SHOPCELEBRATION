UPDATE orders
   SET tracking_token_hash = 'revoked:' || id,
       tracking_expires_at = LEAST(tracking_expires_at, now()),
       updated_at = now()
 WHERE status = 'cancelled'
   AND tracking_token_hash IS NOT NULL;
