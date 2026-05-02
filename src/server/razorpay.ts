// Server functions for Razorpay checkout.
// - createOrder: creates a Razorpay order on the server using the secret key
// - verifyPayment: verifies the payment signature after the popup completes
//
// Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from server env (Lovable Cloud secrets).

import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { amount: number; receipt?: string }) => {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid amount");
    }
    if (amount > 1_000_000) throw new Error("Amount too large");
    return { amount, receipt: typeof input.receipt === "string" ? input.receipt.slice(0, 40) : undefined };
  })
  .handler(async ({ data }) => {
    const keyId = "process.env.VITE_RAZORPAY_KEY_ID";
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay keys not configured");
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const body = {
      amount: Math.round(data.amount * 100), // paise
      currency: "INR",
      receipt: data.receipt ?? `vm_${Date.now()}`,
      payment_capture: 1,
    };

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      amount?: number;
      currency?: string;
      error?: { description?: string; code?: string };
    };
    if (!res.ok || !json.id) {
      const msg = json.error?.description ?? `Razorpay error (HTTP ${res.status})`;
      console.error("[razorpay] createOrder failed:", res.status, JSON.stringify(json));
      // Surface a friendly message; flag auth issues so the UI can guide the user.
      if (json.error?.code === "BAD_REQUEST_ERROR" && /authentication/i.test(json.error?.description ?? "")) {
        throw new Error("Razorpay credentials invalid. Please update RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET with valid test keys from your Razorpay dashboard.");
      }
      throw new Error(msg);
    }
    return {
      orderId: json.id,
      amount: json.amount ?? body.amount,
      currency: json.currency ?? "INR",
      keyId, // safe — this is the publishable key id
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
      if (!input.razorpay_order_id || !input.razorpay_payment_id || !input.razorpay_signature) {
        throw new Error("Missing payment fields");
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay keys not configured");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const valid = expected === data.razorpay_signature;
    return { valid };
  });
