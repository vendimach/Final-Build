-- ============ WALLET SYSTEM MIGRATION ============
-- Renames loyalty_points → wallet_balance (NUMERIC for ₹ amounts)
-- Adds wallet_transactions table
-- Adds wallet_credited flag on orders
-- Adds 3 SECURITY DEFINER RPC functions for safe client-side calls

-- 1. Rename and retype the balance column
ALTER TABLE public.profiles
  RENAME COLUMN loyalty_points TO wallet_balance;

ALTER TABLE public.profiles
  ALTER COLUMN wallet_balance TYPE NUMERIC(12,2)
  USING wallet_balance::NUMERIC(12,2);

-- 2. Wallet transactions ledger
CREATE TABLE public.wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('order_cashback', 'referral_credit', 'manual_credit', 'debit')),
  reference_id UUID,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);
-- Admins can see all
CREATE POLICY "Admins view all wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_wallet_txn_user ON public.wallet_transactions(user_id);

-- 3. Prevent double-crediting orders
ALTER TABLE public.orders
  ADD COLUMN wallet_credited BOOLEAN NOT NULL DEFAULT false;

-- ============ RPC: credit_order_wallet ============
-- Credits 1/10 of order total to wallet if total > 799 and not yet credited.
-- Returns the credit amount (0 if conditions not met).
CREATE OR REPLACE FUNCTION public.credit_order_wallet(p_order_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  public.orders%ROWTYPE;
  v_credit NUMERIC(10,2);
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not authorized';
  END IF;

  IF v_order.wallet_credited THEN
    RETURN 0;
  END IF;

  IF v_order.total <= 799 THEN
    RETURN 0;
  END IF;

  v_credit := FLOOR(v_order.total / 10);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_credit
  WHERE id = auth.uid();

  INSERT INTO public.wallet_transactions
    (user_id, amount, type, reference_id, description)
  VALUES
    (auth.uid(), v_credit, 'order_cashback', p_order_id,
     'Cashback for order ' || v_order.order_number);

  UPDATE public.orders
  SET wallet_credited = true
  WHERE id = p_order_id;

  RETURN v_credit;
END;
$$;

-- ============ RPC: process_referral_signup ============
-- Call after a new user signs up with a referral code.
-- Links the new user to the referrer via referred_by and creates a referrals record.
CREATE OR REPLACE FUNCTION public.process_referral_signup(p_referrer_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = upper(trim(p_referrer_code));

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Prevent self-referral
  IF v_referrer_id = auth.uid() THEN
    RETURN;
  END IF;

  -- Link only if not already referred
  UPDATE public.profiles
  SET referred_by = v_referrer_id
  WHERE id = auth.uid() AND referred_by IS NULL;

  -- Create pending referral record (idempotent)
  INSERT INTO public.referrals (referrer_id, referred_user_id, status)
  VALUES (v_referrer_id, auth.uid(), 'pending')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============ RPC: process_first_order_referral ============
-- Call after a user's first paid order.
-- If the user was referred, credits ₹100 to the referrer's wallet.
CREATE OR REPLACE FUNCTION public.process_first_order_referral(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_order_count  INTEGER;
BEGIN
  SELECT referred_by INTO v_referrer_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;

  -- Count this user's non-cancelled orders (including the current one just inserted)
  SELECT COUNT(*) INTO v_order_count
  FROM public.orders
  WHERE user_id = auth.uid()
    AND status NOT IN ('cancelled', 'refunded');

  -- Only reward on the very first order
  IF v_order_count > 1 THEN
    RETURN;
  END IF;

  SELECT id INTO v_referral_id
  FROM public.referrals
  WHERE referrer_id = v_referrer_id
    AND referred_user_id = auth.uid()
    AND rewarded = false;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Credit ₹100 to referrer
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + 100
  WHERE id = v_referrer_id;

  INSERT INTO public.wallet_transactions
    (user_id, amount, type, reference_id, description)
  VALUES
    (v_referrer_id, 100, 'referral_credit', p_order_id,
     'Referral bonus — your friend placed their first order');

  UPDATE public.referrals
  SET rewarded = true, status = 'completed'
  WHERE id = v_referral_id;
END;
$$;
