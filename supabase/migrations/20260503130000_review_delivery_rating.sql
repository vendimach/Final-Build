-- Add delivery_rating dimension to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS delivery_rating INTEGER;
