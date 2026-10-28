// The simulated store: catalogue, cities, calendar effects and behaviour parameters.
// Every assumption the simulator makes lives here so it can be documented and audited.

export const SIM_SEED = 20261028;
export const SIM_DB_NAME = "Ecommerce_sim";

// Simulation window in IST calendar days (inclusive)
export const SIM_START = "2025-10-28";
export const SIM_END = "2026-10-27";

export const BASE_SESSIONS_PER_DAY = 900;
export const MONTHLY_GROWTH = 0.035;

export type Category = "tees" | "tanks" | "quarter zips" | "hoodies" | "bottoms" | "shorts";

type Line = {
  name: string;
  category: Category;
  price: number;
  comparePrice?: number;
  colors: string[];
  photo: string;
  // Relative demand for the line; individual colours get extra random spread
  demand: number;
};

export const LINES: Line[] = [
  { name: "Everyday Fitted Tee", category: "tees", price: 999, colors: ["Black", "White", "Grey", "Navy", "Brown", "Olive", "Maroon", "Sand"], photo: "uploads/seed-9.svg", demand: 1.6 },
  { name: "Everyday Fitted Tee 2 Pack", category: "tees", price: 1799, comparePrice: 1998, colors: ["Black/White", "Navy/Grey", "Olive/Sand"], photo: "uploads/seed-2.svg", demand: 1.3 },
  { name: "Everyday Fitted Tee 3 Pack", category: "tees", price: 2499, comparePrice: 2997, colors: ["Black/White/Grey", "Navy/Olive/Brown"], photo: "uploads/seed-4.svg", demand: 1.0 },
  { name: "Premium Ultra-Soft Cotton Fitted Tank", category: "tanks", price: 799, colors: ["Mocha", "Black", "White", "Slate", "Olive", "Navy"], photo: "uploads/seed-5.svg", demand: 1.2 },
  { name: "Premium Ultra-Soft Cotton Fitted Tank 3 Pack", category: "tanks", price: 1799, comparePrice: 2397, colors: ["White/Slate/Black", "Mocha/Olive/Navy"], photo: "uploads/seed-1.svg", demand: 1.1 },
  { name: "Acid Wash Fitted Tank 2 Pack", category: "tanks", price: 1799, comparePrice: 1998, colors: ["Grey/Charcoal", "Sand/Olive"], photo: "uploads/seed-3.svg", demand: 0.6 },
  { name: "Core Sleeveless Athletic Tank", category: "tanks", price: 999, colors: ["Black", "Grey", "White"], photo: "uploads/seed-16.svg", demand: 0.7 },
  { name: "Longline Gym Stringer", category: "tanks", price: 899, colors: ["Black", "White"], photo: "uploads/seed-8.svg", demand: 0.4 },
  { name: "Fitted Performance Quarter Zip", category: "quarter zips", price: 1999, comparePrice: 2999, colors: ["Sand", "Navy", "Cypress Green", "Black", "Charcoal"], photo: "uploads/seed-12.svg", demand: 1.1 },
  { name: "Seamless Long Sleeve Tee", category: "tees", price: 1499, colors: ["Black", "Navy", "Olive"], photo: "uploads/seed-10.svg", demand: 0.6 },
  { name: "Essential Oversized Hoodie", category: "hoodies", price: 2299, colors: ["Black", "Grey Melange", "Navy", "Olive"], photo: "uploads/seed-13.svg", demand: 0.9 },
  { name: "Essential Oversized Vintage Sweatpants", category: "bottoms", price: 1799, colors: ["Washed Black", "Grey", "Navy"], photo: "uploads/seed-15.svg", demand: 0.7 },
  { name: "Performance Training Shorts", category: "shorts", price: 1199, colors: ["Black", "Navy", "Grey", "Olive"], photo: "uploads/seed-14.svg", demand: 0.8 },
];

export const SIZES = ["S", "M", "L", "XL", "2XL"];
export const SIZE_WEIGHTS = [0.18, 0.32, 0.28, 0.16, 0.06];

// Month (1-12) multipliers on demand by category: summer tanks/shorts, winter layers
export const SEASONALITY: Record<Category, number[]> = {
  tees: [1, 1, 1, 1.05, 1.1, 1.1, 1, 1, 1, 1, 1, 1],
  tanks: [0.6, 0.7, 0.9, 1.4, 1.6, 1.6, 1.3, 1.1, 1, 0.9, 0.7, 0.6],
  shorts: [0.6, 0.7, 0.9, 1.4, 1.6, 1.5, 1.2, 1.1, 1, 0.9, 0.7, 0.6],
  "quarter zips": [1.6, 1.4, 1.1, 0.7, 0.5, 0.5, 0.7, 0.8, 1, 1.2, 1.5, 1.7],
  hoodies: [1.8, 1.5, 1.1, 0.6, 0.4, 0.4, 0.6, 0.7, 1, 1.3, 1.6, 1.9],
  bottoms: [1.3, 1.2, 1, 0.8, 0.7, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3],
};

// Mon..Sun traffic multipliers (JS getUTCDay: 0 = Sunday)
export const WEEKDAY_TRAFFIC = [1.25, 0.92, 0.9, 0.95, 0.97, 1.03, 1.22];

// Share of sessions starting in each IST hour
export const HOUR_WEIGHTS = [
  0.012, 0.007, 0.004, 0.003, 0.003, 0.005, 0.012, 0.025, 0.035, 0.042, 0.046, 0.05,
  0.055, 0.058, 0.052, 0.048, 0.047, 0.05, 0.056, 0.064, 0.074, 0.082, 0.07, 0.04,
];

export type SaleEvent = {
  name: string;
  start: string;
  end: string;
  traffic: number;
  conversion: number;
  coupon?: { code: string; amount: number; minSubtotal: number; useRate: number };
};

export const SALES: SaleEvent[] = [
  {
    // Big Billion Days-style festive sale
    name: "Big Saint Days",
    start: "2026-09-26",
    end: "2026-10-03",
    traffic: 3.2,
    conversion: 1.45,
    coupon: { code: "BIGSAINT200", amount: 200, minSubtotal: 1499, useRate: 0.45 },
  },
  { name: "End of Season Sale", start: "2026-01-10", end: "2026-01-17", traffic: 1.6, conversion: 1.2 },
];

export type City = { name: string; state: string; tier: "metro" | "tier2" | "tier3"; pin: string; weight: number };

export const CITIES: City[] = [
  { name: "Bengaluru", state: "Karnataka", tier: "metro", pin: "560", weight: 12 },
  { name: "Mumbai", state: "Maharashtra", tier: "metro", pin: "400", weight: 10 },
  { name: "Delhi", state: "Delhi", tier: "metro", pin: "110", weight: 10 },
  { name: "Hyderabad", state: "Telangana", tier: "metro", pin: "500", weight: 7 },
  { name: "Pune", state: "Maharashtra", tier: "metro", pin: "411", weight: 7 },
  { name: "Chennai", state: "Tamil Nadu", tier: "metro", pin: "600", weight: 6 },
  { name: "Kolkata", state: "West Bengal", tier: "metro", pin: "700", weight: 5 },
  { name: "Ahmedabad", state: "Gujarat", tier: "tier2", pin: "380", weight: 4 },
  { name: "Jaipur", state: "Rajasthan", tier: "tier2", pin: "302", weight: 3 },
  { name: "Lucknow", state: "Uttar Pradesh", tier: "tier2", pin: "226", weight: 3 },
  { name: "Chandigarh", state: "Chandigarh", tier: "tier2", pin: "160", weight: 2 },
  { name: "Indore", state: "Madhya Pradesh", tier: "tier2", pin: "452", weight: 2 },
  { name: "Kochi", state: "Kerala", tier: "tier2", pin: "682", weight: 2 },
  { name: "Nagpur", state: "Maharashtra", tier: "tier2", pin: "440", weight: 2 },
  { name: "Surat", state: "Gujarat", tier: "tier2", pin: "395", weight: 2 },
  { name: "Ludhiana", state: "Punjab", tier: "tier2", pin: "141", weight: 1.5 },
  { name: "Patna", state: "Bihar", tier: "tier3", pin: "800", weight: 2 },
  { name: "Guwahati", state: "Assam", tier: "tier3", pin: "781", weight: 1.5 },
  { name: "Ranchi", state: "Jharkhand", tier: "tier3", pin: "834", weight: 1 },
  { name: "Dehradun", state: "Uttarakhand", tier: "tier3", pin: "248", weight: 1 },
  { name: "Varanasi", state: "Uttar Pradesh", tier: "tier3", pin: "221", weight: 1 },
  { name: "Raipur", state: "Chhattisgarh", tier: "tier3", pin: "492", weight: 1 },
  { name: "Bhubaneswar", state: "Odisha", tier: "tier3", pin: "751", weight: 1 },
  { name: "Agra", state: "Uttar Pradesh", tier: "tier3", pin: "282", weight: 1 },
  { name: "Madurai", state: "Tamil Nadu", tier: "tier3", pin: "625", weight: 1 },
];

// Behaviour parameters. Funnel probabilities are per session / per step.
export const BEHAVIOUR = {
  searchRate: 0.28,
  zeroResultShare: 0.14,
  addToCart: 0.075,
  addToCartReturning: 3.0,
  addToCartDevice: { mobile: 0.95, desktop: 1.15, tablet: 1.0 },
  searchIntent: 1.3,
  extraItem: 0.25,
  removeFromCart: 0.14,
  checkout: 0.5,
  checkoutReturning: 1.35,
  // Shoppers below the free-shipping line: some top up the cart, some leave
  belowThresholdTopUp: 0.3,
  belowThresholdAbandon: 0.12,
  paymentAttempt: 0.82,
  orderSuccess: { COD: 0.97, ONLINE: 0.86 },
  codShare: { metro: 0.38, tier2: 0.55, tier3: 0.7 },
  codShareReturningDelta: -0.1,
  // Returns and logistics
  cancelRate: { COD: 0.075, ONLINE: 0.03 },
  rtoRate: { COD: { metro: 0.1, tier2: 0.14, tier3: 0.2 }, ONLINE: { metro: 0.02, tier2: 0.02, tier3: 0.03 } },
  returnRate: { COD: 0.055, ONLINE: 0.04 },
  deliveryDays: { metro: [2, 4], tier2: [3, 5], tier3: [4, 7] } as Record<City["tier"], [number, number]>,
  welcomeCouponRate: 0.18,
  // After each order: chance the customer comes back, and mean days until they do
  returnVisit: { afterFirst: 0.6, afterRepeat: 0.7, meanDays: 40 },
  browseOnlyVisits: 2.0,
};

// Experiments as they ran in the simulation (assignment uses the live hash function)
export const SIM_EXPERIMENTS = {
  coupon_offer: {
    start: "2026-06-15",
    end: "2026-07-31",
    // Chance an exposed shopper redeems the offered code, and the nudge it gives checkout
    redemption: { control: 0.2, treatment: 0.28 },
    checkoutLift: { control: 1.02, treatment: 1.04 },
  },
  free_shipping_threshold: { start: "2026-08-12", end: "2026-09-24" },
};

export const SEARCH_TERMS = [
  "tee", "black tee", "fitted tee", "tank", "gym tank", "hoodie", "quarter zip",
  "shorts", "sweatpants", "3 pack", "oversized", "white tee", "stringer", "long sleeve",
];
// Searched for but not stocked: these surface in "zero-result searches"
export const ZERO_RESULT_TERMS = ["joggers", "socks", "cap", "compression", "polo", "gym bag", "track pants", "vest"];

export const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Kabir", "Ananya", "Diya", "Aadhya", "Saanvi", "Myra", "Ira", "Kiara", "Riya", "Neha", "Priya", "Rahul", "Karan", "Siddharth", "Varun", "Nikhil", "Meera", "Tanvi", "Pooja", "Aman", "Yash"];
export const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Patel", "Shah", "Mehta", "Singh", "Kumar", "Das", "Bose", "Joshi", "Kulkarni", "Rao", "Menon", "Chopra", "Malhotra", "Agarwal", "Bhat", "Pillai", "Saxena", "Mishra", "Yadav"];
