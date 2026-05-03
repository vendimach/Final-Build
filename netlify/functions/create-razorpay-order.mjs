import { createHmac } from "node:crypto";

export default async function handler(req) {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (amount > 1_000_000) {
    return Response.json({ error: "Amount too large" }, { status: 400 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return Response.json({ error: "Razorpay keys not configured" }, { status: 500 });
  }

  const receipt =
    typeof body.receipt === "string"
      ? body.receipt.slice(0, 40)
      : `vm_${Date.now()}`;

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const orderBody = {
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt,
    payment_capture: 1,
  };

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderBody),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.id) {
    const msg = json.error?.description ?? `Razorpay error (HTTP ${res.status})`;
    console.error("[razorpay] createOrder failed:", res.status, JSON.stringify(json));
    return Response.json({ error: msg }, { status: 502 });
  }

  return Response.json({
    orderId: json.id,
    amount: json.amount ?? orderBody.amount,
    currency: json.currency ?? "INR",
    keyId,
  });
}
