-- Licenses table — stores subscription state per user
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'community' CHECK (tier IN ('community', 'solo', 'operator', 'scale')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_licenses_user_id ON licenses(user_id);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_stripe_customer ON licenses(stripe_customer_id);

-- RLS: users can only read their own license
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own license"
  ON licenses FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access"
  ON licenses FOR ALL
  USING (auth.role() = 'service_role');
