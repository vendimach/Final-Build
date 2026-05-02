
DROP POLICY IF EXISTS "Anyone can subscribe to stock alerts" ON public.stock_notifications;
CREATE POLICY "Anyone can subscribe to stock alerts" ON public.stock_notifications
  FOR INSERT
  WITH CHECK (
    product_id IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND char_length(email) <= 254
  );

DROP POLICY IF EXISTS "Anyone can sign up for newsletter" ON public.newsletter_signups;
CREATE POLICY "Anyone can sign up for newsletter" ON public.newsletter_signups
  FOR INSERT
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND char_length(email) <= 254
  );
