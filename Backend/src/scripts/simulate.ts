// Generates ~12 months of SIMULATED store activity into a separate database (Ecommerce_sim).
// Deterministic: the same seed always produces the same data. Every document is tagged simulated: true.
//
// Usage: npm run seed:sim
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import mongoose from "mongoose";
import { Device, IST_OFFSET_MS } from "../analytics/constants.js";
import { EXPERIMENTS, EXPERIMENT_COUPONS, Variant, assignVariant } from "../analytics/experiments.js";
import { couponDiscount, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "../utils/pricing.js";
import { createRng } from "./sim/random.js";
import {
  BASE_SESSIONS_PER_DAY,
  BEHAVIOUR as B,
  CITIES,
  City,
  FIRST_NAMES,
  HOUR_WEIGHTS,
  LAST_NAMES,
  LINES,
  MONTHLY_GROWTH,
  SALES,
  SEARCH_TERMS,
  SEASONALITY,
  SIM_DB_NAME,
  SIM_END,
  SIM_EXPERIMENTS,
  SIM_SEED,
  SIM_START,
  SIZES,
  SIZE_WEIGHTS,
  WEEKDAY_TRAFFIC,
  ZERO_RESULT_TERMS,
} from "./sim/world.js";

config({ path: "./.env" });

const rng = createRng(SIM_SEED);
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- calendar helpers (all bucketing is by IST calendar day) ----------

const istDayStartUtc = (isoDay: string) => Date.parse(`${isoDay}T00:00:00Z`) - IST_OFFSET_MS;
const isoDayOf = (dayStartUtc: number) => new Date(dayStartUtc + IST_OFFSET_MS).toISOString().slice(0, 10);
const inRange = (day: string, start: string, end: string) => day >= start && day <= end;

const START_UTC = istDayStartUtc(SIM_START);
const END_UTC = istDayStartUtc(SIM_END) + DAY_MS - 1;
const DAYS = Math.round((istDayStartUtc(SIM_END) - START_UTC) / DAY_MS) + 1;

// ---------- catalogue ----------

type SimProduct = {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: keyof typeof SEASONALITY;
  price: number;
  comparePrice: number;
  photo: string;
  color: string;
  popularity: number;
  initialStock: number;
  sold: number;
};

const products: SimProduct[] = LINES.flatMap((line) =>
  line.colors.map((color, i) => ({
    _id: new mongoose.Types.ObjectId(rng.hex(24)),
    name: `${line.name} - ${color}`,
    category: line.category,
    price: line.price,
    comparePrice: line.comparePrice ?? 0,
    photo: line.photo,
    color,
    // Long-tailed demand: first colours sell best, plus lognormal noise
    popularity: line.demand * Math.exp(rng.normal(0, 0.55)) * (1 / (1 + i * 0.25)),
    initialStock: 0,
    sold: 0,
  }))
);

// ---------- customers and visitors ----------

type Customer = {
  _id: string;
  anonId: string;
  name: string;
  email: string;
  phone: string;
  city: City;
  device: Device;
  createdAt: Date;
  orders: number;
};

const customers: Customer[] = [];
// Customer return visits scheduled by day index
const scheduledVisits = new Map<number, Customer[]>();
// Recent anonymous visitors who may come back without buying
const anonPool: { anonId: string; device: Device; lastDay: number }[] = [];

const pickDevice = (): Device =>
  rng.weighted(["mobile", "desktop", "tablet"] as const, (d) => ({ mobile: 0.7, desktop: 0.24, tablet: 0.06 })[d]);

const scheduleReturn = (c: Customer, dayIndex: number, probability: number) => {
  // A buyer may come back to browse a few times and maybe buy again
  if (!rng.chance(probability)) return;
  const visits = 1 + rng.poisson(B.browseOnlyVisits);
  for (let i = 0; i < visits; i++) {
    const day = dayIndex + 1 + Math.floor(rng.exponential(B.returnVisit.meanDays) * (1 + i * 0.6));
    if (day >= DAYS) continue;
    const list = scheduledVisits.get(day) ?? [];
    list.push(c);
    scheduledVisits.set(day, list);
  }
};

const newCustomer = (anonId: string, device: Device, at: Date): Customer => {
  const n = customers.length + 1;
  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_NAMES);
  const c: Customer = {
    _id: `sim-${rng.hex(8)}-${rng.hex(4)}-${rng.hex(4)}-${rng.hex(12)}`,
    anonId,
    name: `${first} ${last}`,
    // Reserved example domain: these addresses can never belong to a real person
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${n}@example.com`,
    phone: `9${rng.int(100000000, 999999999)}`,
    city: rng.weighted(CITIES, (x) => x.weight),
    device,
    createdAt: at,
    orders: 0,
  };
  customers.push(c);
  return c;
};

// ---------- output buffers ----------

type EventDoc = {
  session_id: string;
  anon_id: string;
  user_id: string | null;
  type: string;
  product_id: mongoose.Types.ObjectId | null;
  metadata: Record<string, string | number | boolean | null>;
  experiment: string | null;
  variant: string | null;
  device: Device;
  is_returning: boolean;
  simulated: true;
  timestamp: Date;
};

type OrderDoc = Record<string, unknown>;

let eventBuffer: EventDoc[] = [];
let orderBuffer: OrderDoc[] = [];
let totals = { sessions: 0, events: 0, orders: 0 };

const db = () => mongoose.connection.db!;

const flush = async (force = false) => {
  if (eventBuffer.length >= 20000 || (force && eventBuffer.length)) {
    await db().collection("events").insertMany(eventBuffer, { ordered: false });
    totals.events += eventBuffer.length;
    eventBuffer = [];
  }
  if (orderBuffer.length >= 2000 || (force && orderBuffer.length)) {
    await db().collection("orders").insertMany(orderBuffer, { ordered: false });
    totals.orders += orderBuffer.length;
    orderBuffer = [];
  }
};

// ---------- one shopping session ----------

const experimentVariant = (key: keyof typeof SIM_EXPERIMENTS, day: string, anonId: string): Variant | null => {
  const window = SIM_EXPERIMENTS[key];
  return inRange(day, window.start, window.end) ? assignVariant(key, anonId) : null;
};

const simulateSession = (dayIndex: number, dayStartUtc: number, visitor: { anonId: string; device: Device; customer: Customer | null }) => {
  const day = isoDayOf(dayStartUtc);
  const month = new Date(dayStartUtc + IST_OFFSET_MS).getUTCMonth();
  const sale = SALES.find((s) => inRange(day, s.start, s.end));
  const hour = rng.weighted(HOUR_WEIGHTS.map((w, h) => ({ w, h })), (x) => x.w).h;
  let t = dayStartUtc + hour * 3600_000 + rng.int(0, 3599) * 1000;
  // Keep whole sessions inside the window
  if (t > END_UTC - 3 * 3600_000 && dayStartUtc + DAY_MS > END_UTC) t -= 3 * 3600_000;

  const sessionId = `sim-s-${rng.hex(16)}`;
  const customer = visitor.customer;
  const returning = Boolean(customer && customer.orders > 0);
  totals.sessions++;

  const emit = (type: string, extra: Partial<EventDoc> = {}) => {
    t += rng.int(8, 150) * 1000;
    eventBuffer.push({
      session_id: sessionId,
      anon_id: visitor.anonId,
      user_id: customer?._id ?? null,
      type,
      product_id: null,
      metadata: {},
      experiment: null,
      variant: null,
      device: visitor.device,
      is_returning: returning,
      simulated: true,
      timestamp: new Date(t),
      ...extra,
    });
  };

  const demand = (p: SimProduct) => p.popularity * SEASONALITY[p.category][month];

  // --- discovery: optional search, then product views
  let intent = 1;
  if (rng.chance(B.searchRate)) {
    const zero = rng.chance(B.zeroResultShare);
    // Search interest is long-tailed: earlier terms in each list are searched far more
    const terms = zero ? ZERO_RESULT_TERMS : SEARCH_TERMS;
    const term = rng.weighted(terms, (x) => 1 / (1 + terms.indexOf(x)));
    const results = zero ? 0 : rng.int(2, 18);
    emit(zero ? "search_zero_results" : "search", { metadata: { term, results, source: "live_search" } });
    if (zero && rng.chance(0.5)) return; // bounced after finding nothing
    intent = zero ? 0.8 : B.searchIntent;
  }

  const viewed: SimProduct[] = [];
  const views = 1 + rng.poisson(1.6);
  for (let i = 0; i < views; i++) {
    const p = rng.weighted(products, demand);
    viewed.push(p);
    emit("product_view", { product_id: p._id, metadata: { category: p.category, price: p.price } });
  }

  // --- cart
  const atc =
    B.addToCart *
    intent *
    (returning ? B.addToCartReturning : 1) *
    B.addToCartDevice[visitor.device] *
    (sale?.conversion ?? 1);
  if (!rng.chance(Math.min(atc, 0.9))) return;

  type Line = { product: SimProduct; quantity: number; size: string };
  const cart: Line[] = [];
  const addItem = (p: SimProduct) => {
    const size = rng.weighted(SIZES.map((s, i) => ({ s, w: SIZE_WEIGHTS[i] })), (x) => x.w).s;
    cart.push({ product: p, quantity: 1, size });
    emit("add_to_cart", { product_id: p._id, metadata: { quantity: 1, size, price: p.price } });
  };
  addItem(rng.weighted(viewed, demand));
  if (rng.chance(B.extraItem * (sale ? 1.4 : 1))) addItem(rng.weighted(products, demand));
  if (rng.chance(0.07)) addItem(rng.weighted(products, demand));

  // Experiments are exposed when the shopper sees the cart with items
  const shipVariant = experimentVariant("free_shipping_threshold", day, visitor.anonId);
  const couponVariant = experimentVariant("coupon_offer", day, visitor.anonId);
  if (shipVariant)
    emit("experiment_exposure", { experiment: "free_shipping_threshold", variant: shipVariant });
  if (couponVariant) emit("experiment_exposure", { experiment: "coupon_offer", variant: couponVariant });

  if (cart.length > 1 && rng.chance(B.removeFromCart)) {
    const [removed] = cart.splice(rng.int(0, cart.length - 1), 1);
    emit("remove_from_cart", { product_id: removed.product._id, metadata: { size: removed.size } });
  }

  const subtotalOf = () => cart.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const threshold = shipVariant
    ? EXPERIMENTS.free_shipping_threshold.variants[shipVariant].freeShippingThreshold!
    : FREE_SHIPPING_THRESHOLD;

  // The free-shipping bar: under the line, some shoppers top up and some leave
  if (subtotalOf() < threshold) {
    if (rng.chance(B.belowThresholdTopUp)) {
      const cheap = products.filter((p) => p.price >= threshold - subtotalOf());
      addItem(rng.weighted(cheap.length ? cheap : products, demand));
    } else if (rng.chance(B.belowThresholdAbandon)) return;
  }

  // --- checkout
  const couponLift = couponVariant ? SIM_EXPERIMENTS.coupon_offer.checkoutLift[couponVariant] : 1;
  const checkoutP = B.checkout * (returning ? B.checkoutReturning : 1) * (sale ? 1.1 : 1) * couponLift;
  if (!rng.chance(Math.min(checkoutP, 0.95))) return;
  emit("checkout_started", { metadata: { items: cart.length, subtotal: subtotalOf() } });

  const subtotal = subtotalOf();
  const buyer = customer ?? null;
  const city = buyer?.city ?? rng.weighted(CITIES, (x) => x.weight);

  // Coupon: experiment offer, festive code, or welcome code for first orders
  let coupon: (typeof EXPERIMENT_COUPONS)[number] | { code: string; type: "flat"; amount: number } | null = null;
  if (couponVariant && rng.chance(SIM_EXPERIMENTS.coupon_offer.redemption[couponVariant])) {
    coupon = EXPERIMENT_COUPONS.find((c) => c.code === EXPERIMENTS.coupon_offer.variants[couponVariant].couponCode)!;
  } else if (sale?.coupon && subtotal >= sale.coupon.minSubtotal && rng.chance(sale.coupon.useRate)) {
    coupon = { code: sale.coupon.code, type: "flat", amount: sale.coupon.amount };
  } else if (!returning && rng.chance(B.welcomeCouponRate)) {
    coupon = { code: "WELCOME100", type: "flat", amount: 100 };
  }
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
  if (coupon) emit("coupon_applied", { metadata: { code: coupon.code, discount, subtotal } });

  if (!rng.chance(B.paymentAttempt)) return;
  const codP = B.codShare[city.tier] + (returning ? B.codShareReturningDelta : 0) + (subtotal < threshold ? 0.05 : 0);
  const method = rng.chance(codP) ? "COD" : "ONLINE";
  emit("payment_attempted", { metadata: { method, total: subtotal - discount } });
  if (!rng.chance(B.orderSuccess[method])) return;

  // --- order
  const placedAt = t + rng.int(20, 90) * 1000;
  const buyerCustomer = buyer ?? newCustomer(visitor.anonId, visitor.device, new Date(placedAt));
  const shippingCharges = method === "ONLINE" || subtotal >= threshold ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingCharges - discount;
  const orderId = new mongoose.Types.ObjectId(rng.hex(24));

  // Logistics timeline; anything that would happen after the window end hasn't happened yet
  const history: { status: string; at: Date }[] = [{ status: "Processing", at: new Date(placedAt) }];
  const step = (status: string, afterMs: number) => {
    const at = history[history.length - 1].at.getTime() + afterMs;
    if (at > END_UTC) return false;
    history.push({ status, at: new Date(at) });
    return true;
  };
  if (rng.chance(B.cancelRate[method])) step("Cancelled", rng.int(1, 20) * 3600_000);
  else if (step("Shipped", rng.int(10, 40) * 3600_000)) {
    const [minDays, maxDays] = B.deliveryDays[city.tier];
    if (rng.chance(B.rtoRate[method][city.tier])) step("RTO", rng.int(3, 8) * DAY_MS);
    else if (step("Delivered", rng.int(minDays, maxDays) * DAY_MS + rng.int(0, 12) * 3600_000)) {
      if (rng.chance(B.returnRate[method])) step("Returned", rng.int(3, 9) * DAY_MS);
    }
  }

  orderBuffer.push({
    _id: orderId,
    shippingInfo: {
      name: buyerCustomer.name,
      phone: buyerCustomer.phone,
      address: `${rng.int(1, 300)}, Sector ${rng.int(1, 60)}`,
      city: city.name,
      state: city.state,
      country: "India",
      pinCode: Number(`${city.pin}${String(rng.int(1, 99)).padStart(3, "0")}`),
    },
    user: buyerCustomer._id,
    subtotal,
    tax: 0,
    shippingCharges,
    discount,
    total,
    status: history[history.length - 1].status,
    statusHistory: history,
    paymentMethod: method,
    paymentId: method === "ONLINE" ? `pay_sim_${rng.hex(14)}` : undefined,
    couponCode: coupon?.code ?? null,
    sessionId,
    anonId: visitor.anonId,
    device: visitor.device,
    experiments: shipVariant ? { free_shipping_threshold: shipVariant } : {},
    simulated: true,
    orderItems: cart.map((l) => ({
      _id: new mongoose.Types.ObjectId(rng.hex(24)),
      name: l.product.name,
      photo: l.product.photo,
      price: l.product.price,
      quantity: l.quantity,
      size: l.size,
      productId: l.product._id,
    })),
    createdAt: new Date(placedAt),
    updatedAt: history[history.length - 1].at,
  });
  cart.forEach((l) => (l.product.sold += l.quantity));

  t = placedAt - 1000;
  emit("order_placed", {
    user_id: buyerCustomer._id,
    metadata: { order_id: String(orderId), total, payment_method: method },
  });

  buyerCustomer.orders++;
  scheduleReturn(
    buyerCustomer,
    dayIndex,
    buyerCustomer.orders === 1 ? B.returnVisit.afterFirst : B.returnVisit.afterRepeat
  );
};

// ---------- main ----------

const main = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env");
  await mongoose.connect(uri, { dbName: SIM_DB_NAME });
  console.log(`Simulating ${DAYS} days (${SIM_START} → ${SIM_END}) into "${SIM_DB_NAME}", seed ${SIM_SEED}`);

  // Start clean: this database only ever holds simulated data
  for (const name of ["events", "orders", "products", "users", "coupons", "experiments"])
    await db().collection(name).deleteMany({});

  const started = Date.now();
  for (let d = 0; d < DAYS; d++) {
    const dayStart = START_UTC + d * DAY_MS;
    const day = isoDayOf(dayStart);
    const weekday = new Date(dayStart + IST_OFFSET_MS).getUTCDay();
    const sale = SALES.find((s) => inRange(day, s.start, s.end));
    const expected =
      BASE_SESSIONS_PER_DAY *
      WEEKDAY_TRAFFIC[weekday] *
      (1 + MONTHLY_GROWTH * (d / 30.4)) *
      (sale?.traffic ?? 1) *
      Math.exp(rng.normal(0, 0.08));

    // Returning customers who planned to visit today
    for (const c of scheduledVisits.get(d) ?? [])
      simulateSession(d, dayStart, { anonId: c.anonId, device: c.device, customer: c });
    scheduledVisits.delete(d);

    const fresh = Math.round(expected);
    for (let i = 0; i < fresh; i++) {
      // Some anonymous visitors come back within a month without having bought
      const recent = anonPool.length && rng.chance(0.2) ? rng.pick(anonPool) : null;
      const visitor =
        recent && d - recent.lastDay < 30
          ? recent
          : { anonId: `sim-a-${rng.hex(16)}`, device: pickDevice(), lastDay: d };
      visitor.lastDay = d;
      if (visitor !== recent) {
        anonPool.push(visitor);
        if (anonPool.length > 5000) anonPool.shift();
      }
      simulateSession(d, dayStart, { anonId: visitor.anonId, device: visitor.device, customer: null });
    }
    await flush();
    if (d % 30 === 0) console.log(`  ${day}: ${totals.sessions} sessions so far`);
  }
  await flush(true);

  // Stock left = a random opening stock minus what sold, so some SKUs run low
  const productDocs = products.map((p) => {
    const dailyRate = p.sold / DAYS;
    const coverDays = rng.chance(0.15) ? rng.int(0, 10) : rng.int(20, 120);
    return {
      _id: p._id,
      name: p.name,
      photo: p.photo,
      price: p.price,
      comparePrice: p.comparePrice,
      stock: Math.max(0, Math.round(dailyRate * coverDays)),
      category: p.category,
      description: "Simulated catalogue item.",
      sizes: SIZES,
      color: p.color,
      rating: 0,
      numReviews: 0,
      simulated: true,
      createdAt: new Date(START_UTC - 90 * DAY_MS),
      updatedAt: new Date(END_UTC),
    };
  });
  await db().collection("products").insertMany(productDocs);

  const unusable = await bcrypt.hash(rng.hex(32), 10);
  const userDocs = customers.map((c) => ({
    _id: c._id,
    name: c.name,
    email: c.email,
    password: unusable,
    phone: c.phone,
    photo: "",
    role: "user",
    simulated: true,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
  }));
  for (let i = 0; i < userDocs.length; i += 5000)
    await db().collection<{ _id: string; [field: string]: unknown }>("users").insertMany(userDocs.slice(i, i + 5000));

  // Same admin login as the live store, so you can open the simulated dashboard
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    await db().collection<{ _id: string; [field: string]: unknown }>("users").insertOne({
      _id: "sim-admin",
      name: "Admin",
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
      role: "admin",
      photo: "",
      createdAt: new Date(START_UTC),
      updatedAt: new Date(START_UTC),
    });

  await db().collection("coupons").insertMany([
    { code: "WELCOME100", type: "flat", amount: 100, maxDiscount: null },
    { code: "BIGSAINT200", type: "flat", amount: 200, maxDiscount: null },
    ...EXPERIMENT_COUPONS.map((c) => ({ maxDiscount: null, ...c })),
  ]);

  await db().collection("experiments").insertMany(
    Object.entries(SIM_EXPERIMENTS).map(([key, w]) => ({
      key,
      status: "stopped",
      startedAt: new Date(istDayStartUtc(w.start)),
      stoppedAt: new Date(istDayStartUtc(w.end) + DAY_MS - 1),
      simulated: true,
    }))
  );

  // Build the same indexes the live models declare
  const { Event } = await import("../models/event.js");
  const { Order } = await import("../models/order.js");
  await Promise.all([Event.syncIndexes(), Order.syncIndexes()]);

  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)}s: ${totals.sessions} sessions, ${totals.events} events, ` +
      `${totals.orders} orders, ${customers.length} customers, ${products.length} products`
  );
  await mongoose.disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
