-- Trigger 1: Decrement product stock when an order_item is inserted
CREATE OR REPLACE FUNCTION public._decrement_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public._decrement_product_stock();

-- Trigger 2: Credit 10% cashback when order status transitions to 'delivered'
CREATE OR REPLACE FUNCTION public._credit_wallet_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit NUMERIC(10,2);
BEGIN
  IF NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered')
     AND NOT NEW.wallet_credited
     AND NEW.user_id IS NOT NULL
     AND NEW.total > 799
  THEN
    v_credit := FLOOR(NEW.total / 10);

    UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_credit
    WHERE id = NEW.user_id;

    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id, description)
    VALUES (NEW.user_id, v_credit, 'order_cashback', NEW.id,
            'Cashback for order ' || NEW.order_number);

    UPDATE public.orders
    SET wallet_credited = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_on_delivery ON public.orders;
CREATE TRIGGER trg_wallet_on_delivery
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._credit_wallet_on_delivery();
