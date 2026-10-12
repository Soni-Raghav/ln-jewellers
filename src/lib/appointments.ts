/**
 * Shared atelier-appointment helpers — one source of truth for the booking
 * form (client), the public booking API and the availability API.
 */

export const TIME_SLOTS = [
  "11:00 AM",
  "12:30 PM",
  "2:00 PM",
  "3:30 PM",
  "5:00 PM",
  "6:30 PM",
] as const;

/** Today (IST, UTC+5:30) as YYYY-MM-DD so "today" is bookable during IST hours. */
export function istToday(): string {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}
