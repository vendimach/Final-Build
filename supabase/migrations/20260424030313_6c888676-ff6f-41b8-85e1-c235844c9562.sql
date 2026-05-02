-- Add CSAT score for customer satisfaction metrics
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS csat_score smallint CHECK (csat_score BETWEEN 1 AND 5);

-- Allow customers to rate their own delivered orders
CREATE POLICY "Users can rate own delivered orders"
ON public.orders
FOR UPDATE
USING (auth.uid() = user_id AND status = 'delivered')
WITH CHECK (auth.uid() = user_id AND status = 'delivered');

-- Enable realtime on orders
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;