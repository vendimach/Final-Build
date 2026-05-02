## Plan

1. Repair the `/shop` route structure so the PDP can actually render
- Convert `src/routes/shop.tsx` from a leaf page into a layout route with an `Outlet`.
- Move the current product listing UI into a dedicated index child route for `/shop` so `/shop` shows the grid and `/shop/$slug` shows the product details page.
- Keep the existing PDP route in `src/routes/shop.$slug.tsx`, but make sure it renders as the child route instead of being swallowed by the parent shop page.

2. Make product navigation use an explicit slug everywhere
- Stop overloading `product.id` to mean both “route slug” and “product identity”.
- Add a clear route field to the product model (for example `slug`) while keeping the backend UUID separate (`dbId`).
- Update `ProductCard` links and any other product-entry surfaces to pass the slug explicitly to `/shop/$slug`.
- Ensure the clickable areas are consistent so tapping the product image/title always opens the PDP.
- If needed, also wire the Build Your Box product image/name to the PDP without breaking the add/remove controls.

3. Sweep remaining USD displays and convert them to INR
- Replace hardcoded `$...` formatting with `formatINR(...)` in:
  - `src/routes/admin.index.tsx`
  - `src/routes/admin.orders.tsx`
  - `src/routes/admin.products.tsx`
  - `src/routes/admin.customers.tsx`
  - `src/routes/build-your-box.tsx`
- Update the homepage’s leftover US-market copy and hardcoded dollar bundle teasers in `src/routes/index.tsx` so they match the India setup.
- Reuse the existing INR helper for all totals, revenue, product prices, bundle prices, and chart/tooltips where amounts are shown.

4. Verify the flow end-to-end after implementation
- Confirm clicking a product from the homepage, shop grid, related products, and any other linked surface opens `/shop/<slug>` and shows the PDP.
- Confirm the shop list still works at `/shop`.
- Confirm the targeted admin screens and Build Your Box show INR instead of dollars.
- Do a final scan for leftover `$` price strings in user-facing UI.

## Technical details
- Root cause appears to be route nesting: `/shop/$slug` is a child of `/shop`, but the parent `shop.tsx` is currently a standalone page instead of a layout route, so the child PDP never gets a place to render.
- A small model cleanup will make this more reliable long-term:

```text
Product
- slug     -> used for routing only
- dbId     -> backend UUID for orders/reviews/subscriptions
- id       -> avoid using as an overloaded route value
```

- No database migration is needed for this request; this is a routing/model/UI formatting fix.