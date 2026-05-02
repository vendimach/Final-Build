INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Product photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

CREATE POLICY "Admins can upload product photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update product photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'admin'));