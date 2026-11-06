/**
 * Shared, client-safe validation rules for checkout & enquiry forms.
 * Used by both the API routes (server) and the React views (client) so the
 * two layers never disagree about what a valid submission looks like.
 */

/**
 * Convert common Unicode digits to ASCII 0-9.
 * Indian shoppers on Devanagari / Gujarati / Bengali keyboards produce
 * digits like "६३५०१८०३३६" or "૩૯૫૦૦૩" — these must not fail a phone or
 * PIN check silently.
 */
export function toAsciiDigits(v: string): string {
  return v.replace(
    /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0AE6-\u0AEF\uFF10-\uFF19]/g,
    (d) => {
      const c = d.codePointAt(0) ?? 0;
      if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660); // Arabic-Indic
      if (c >= 0x06f0 && c <= 0x06f9) return String(c - 0x06f0); // Extended Arabic
      if (c >= 0x0966 && c <= 0x096f) return String(c - 0x0966); // Devanagari
      if (c >= 0x09e6 && c <= 0x09ef) return String(c - 0x09e6); // Bengali
      if (c >= 0x0ae6 && c <= 0x0aef) return String(c - 0x0ae6); // Gujarati
      if (c >= 0xff10 && c <= 0xff19) return String(c - 0xff10); // Full-width
      return d;
    }
  );
}

export function isEmailValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/**
 * Phone check tolerant of how Indians actually type numbers:
 * "6350180336", "+91 63501 80336", "+91-9876543210", "(079) 2234 5678",
 * Unicode digits — all accepted. Requires 7–15 digits (E.164 range) with an
 * optional leading "+".
 */
export function isPhoneValid(v: string): boolean {
  const digits = toAsciiDigits(v).replace(/[\s\-().]/g, "");
  return /^\+?\d{7,15}$/.test(digits);
}

export function isPincodeValid(v: string): boolean {
  return /^\d{6}$/.test(toAsciiDigits(v).trim());
}

/** Minimum length for the free-text delivery address (house no. + street + area). */
export const ADDRESS_MIN_LENGTH = 6;

export const CHECKOUT_FIELD_LABELS: Record<string, string> = {
  customerName: "Full name",
  email: "Email",
  phone: "Phone",
  address: "Full address",
  city: "City",
  state: "State",
  pincode: "PIN code",
};

/** "Please check: Full address, PIN code" — human-readable list for toasts & banners. */
export function summarizeFieldErrors(fields: Record<string, string>): string {
  const keys = Object.keys(fields);
  if (keys.length === 0) return "";
  return `Please check: ${keys.map((k) => CHECKOUT_FIELD_LABELS[k] ?? k).join(", ")}`;
}
