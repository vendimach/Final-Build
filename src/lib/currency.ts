// Indian Rupee formatting helpers.
// All prices in the app are stored as plain numbers in INR (₹).

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_DECIMAL = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format an INR amount: ₹1,299 (no decimals if whole number, otherwise ₹1,299.50) */
export function formatINR(amount: number | string | null | undefined, opts?: { decimals?: boolean }): string {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (Number.isNaN(n)) return "₹0";
  if (opts?.decimals) return INR_DECIMAL.format(n);
  return Number.isInteger(n) ? INR.format(n) : INR_DECIMAL.format(n);
}

/** Indian phone (+91) — basic validation. Accepts 10 digits or +91XXXXXXXXXX. */
export function validateIndianPhone(raw: string): { ok: true; e164: string } | { ok: false; error: string } {
  const cleaned = raw.replace(/\s|-/g, "");
  if (/^[6-9]\d{9}$/.test(cleaned)) return { ok: true, e164: `+91${cleaned}` };
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return { ok: true, e164: cleaned };
  if (/^91[6-9]\d{9}$/.test(cleaned)) return { ok: true, e164: `+${cleaned}` };
  return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
}

/** Indian PIN code: 6 digits, first not 0 */
export function validateIndianPincode(raw: string): boolean {
  return /^[1-9]\d{5}$/.test(raw.trim());
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export const FREE_SHIPPING_THRESHOLD = 499;
export const FLAT_SHIPPING_FEE = 49;
