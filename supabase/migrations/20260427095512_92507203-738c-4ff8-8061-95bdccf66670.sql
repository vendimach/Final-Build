ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS taste_rating integer,
ADD COLUMN IF NOT EXISTS quality_rating integer,
ADD COLUMN IF NOT EXISTS texture_rating integer,
ADD COLUMN IF NOT EXISTS value_rating integer;

INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view review photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-photos');

CREATE POLICY "Users can upload own review photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own review photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'review-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'review-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own review photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'review-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);