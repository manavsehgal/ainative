-- Telemetry events — anonymized, append-only usage data
CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  profile_domain TEXT,
  workflow_pattern TEXT,
  activity_type TEXT NOT NULL,
  outcome_status TEXT,
  token_count INTEGER DEFAULT 0,
  cost_micros INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  step_count INTEGER DEFAULT 1,
  week_bucket DATE NOT NULL DEFAULT (date_trunc('week', now()))::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_week ON telemetry_events(week_bucket);
CREATE INDEX idx_telemetry_provider ON telemetry_events(provider_id, model_id);

-- RLS: insert-only via service role, no user SELECT
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role insert telemetry"
  ON telemetry_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role read telemetry"
  ON telemetry_events FOR SELECT
  USING (auth.role() = 'service_role');
