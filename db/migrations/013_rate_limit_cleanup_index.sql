CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx
  ON rate_limits (window_start);
