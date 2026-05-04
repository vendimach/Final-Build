-- Fix process_first_order_referral:
-- 1. Use order's user_id instead of auth.uid() (admin-safe)
-- 2. Credit ₹50 to both referrer AND referee (was ₹100 to referrer only)
-- 3. Add a DB trigger so it fires automatically on delivery

CREATE OR REPLACE FUNCTION public.process_first_order_referral(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referee_id  UUID;
  v_referrer_id UUID;
  v_referral_id UUID;
  v_order_count INTEGER;
BEGIN
  -- Derive the customer from the order (works for both admin and customer callers)
  SELECT user_id INTO v_referee_id
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND OR v_referee_id IS NULL THEN
    RETURN;
  END IF;

  -- Get the referrer
  SELECT referred_by INTO v_referrer_id
  FROM public.profiles
  WHERE id = v_referee_id;

  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;

  -- Only reward on the very first non-cancelled order
  SELECT COUNT(*) INTO v_order_count
  FROM public.orders
  WHERE user_id = v_referee_id
    AND status NOT IN ('cancelled', 'refunded');

  IF v_order_count > 1 THEN
    RETURN;
  END IF;

  -- Find the unrewarded referral record
  SELECT id INTO v_referral_id
  FROM public.referrals
  WHERE referrer_id = v_referrer_id
    AND referred_user_id = v_referee_id
    AND rewarded = false;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Credit ₹50 to referrer
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + 50
  WHERE id = v_referrer_id;

  INSERT INTO public.wallet_transactions
    (user_id, amount, type, reference_id, description)
  VALUES
    (v_referrer_id, 50, 'referral_credit', p_order_id,
     'Referral bonus — your friend placed their first order');

  -- Credit ₹50 to referee (welcome bonus)
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + 50
  WHERE id = v_referee_id;

  INSERT INTO public.wallet_transactions
    (user_id, amount, type, reference_id, description)
  VALUES
    (v_referee_id, 50, 'referral_credit', p_order_id,
     'Welcome bonus — joined via referral');

  -- Mark referral as rewarded
  UPDATE public.referrals
  SET rewarded = true, status = 'completed'
  WHERE id = v_referral_id;
END;
$$;

-- Trigger: fire process_first_order_referral automatically on delivery
-- (so it works even when admin uses Supabase dashboard to update status)
CREATE OR REPLACE FUNCTION public._process_referral_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    PERFORM public.process_first_order_referral(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_on_delivery ON public.orders;
CREATE TRIGGER trg_referral_on_delivery
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._process_referral_on_delivery();
