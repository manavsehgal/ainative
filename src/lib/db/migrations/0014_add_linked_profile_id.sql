-- Add linkedProfileId to environment_artifacts for profile-environment sync
ALTER TABLE environment_artifacts ADD COLUMN linked_profile_id TEXT;
CREATE INDEX IF NOT EXISTS idx_env_artifacts_linked_profile ON environment_artifacts(linked_profile_id);
