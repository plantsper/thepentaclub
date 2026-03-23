-- Add art_url column to cards
ALTER TABLE cards ADD COLUMN art_url TEXT;

-- Create the card-art storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-art',
  'card-art',
  true,
  5242880, -- 5MB max per image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view images
CREATE POLICY "Public can view card art"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-art');

-- Only authenticated admins can upload / update / delete
CREATE POLICY "Authenticated users can upload card art"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'card-art' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update card art"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'card-art' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete card art"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'card-art' AND auth.role() = 'authenticated');
