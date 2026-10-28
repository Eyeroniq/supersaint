import { IST_OFFSET_MS } from "./constants.js";

// Store promotional calendar (IST dates, inclusive). Used to flag sale days in dim_date.
export const PROMO_CALENDAR = [
  { name: "End of Season Sale", start: "2026-01-10", end: "2026-01-17" },
  // Big Billion Days-style festive sale
  { name: "Big Saint Days", start: "2026-09-26", end: "2026-10-03" },
];

export const saleOn = (isoDay: string) =>
  PROMO_CALENDAR.find((s) => isoDay >= s.start && isoDay <= s.end)?.name ?? null;

const shifted = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString();

// "2026-10-27"
export const istDate = (d: Date) => shifted(d).slice(0, 10);
// "2026-10-27 21:05:13" (naive IST timestamp for the warehouse)
export const istTimestamp = (d: Date) => shifted(d).replace("T", " ").slice(0, 19);
// 20261027
export const dateKey = (d: Date) => Number(istDate(d).replace(/-/g, ""));

// UTC instant at which an IST calendar day starts
export const istDayStart = (isoDay: string) => new Date(Date.parse(`${isoDay}T00:00:00Z`) - IST_OFFSET_MS);
