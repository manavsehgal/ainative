-- Create storage bucket for encrypted cloud sync snapshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stagent-sync', 'stagent-sync', false, 104857600, ARRAY['application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only access files in their own folder (path: {user_id}/...)
CREATE POLICY "Users manage own sync files"
ON storage.objects FOR ALL
USING (bucket_id = 'stagent-sync' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'stagent-sync' AND auth.uid()::text = (storage.foldername(name))[1]);
