// Response shapes of /api/v1/analytics (see Backend/src/analytics/service.ts)

export type Range = { from: string; to: string };
export type ApiResponse<T> = { success: boolean; data: T };

export type Meta = {
  database: string;
  simulated: boolean;
  minDate: string | null;
  maxDate: string | null;
  categories: string[];
};

export type KpiSet = {
  sessions: number;
  cartSessions: number;
  convertedSessions: number;
  orders: number;
  gmv: number;
  netRevenue: number;
  buyers: number;
  repeatBuyers: number;
  aov: number;
  conversionRate: number;
  repeatRate: number;
  cartAbandonmentRate: number;
};
export type KpiKey = "gmv" | "orders" | "aov" | "conversionRate" | "repeatRate" | "cartAbandonmentRate" | "sessions" | "netRevenue";
export type Kpis = {
  range: Range;
  previousRange: Range;
  current: KpiSet;
  previous: KpiSet;
  change: Record<KpiKey, number | null>;
};

export type KpiDailyRow = {
  date: string;
  sessions: number;
  orders: number;
  gmv: number;
  net_revenue: number;
  aov: number | null;
  conversion_rate: number | null;
  cart_abandonment_rate: number | null;
  new_customers: number;
  repeat_customers: number;
};

export type FunnelStep = {
  step: string;
  sessions: number;
  stepConversion: number | null;
  dropOff: number | null;
  conversionFromView: number;
};
export type Funnel = {
  range: Range;
  steps: FunnelStep[];
  byDevice: { device: string; steps: FunnelStep[] }[];
};

export type Cohort = {
  cohort: string;
  size: number;
  retention: ({ month: number; customers: number; rate: number } | null)[];
};
export type RfmSegment = {
  segment: string;
  customers: number;
  customerShare: number;
  revenue: number;
  revenueShare: number;
  avgRecencyDays: number;
  avgOrders: number;
  avgSpend: number;
  action: string;
};
export type IntervalSummary = {
  repeatOrders: number;
  avgDays: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  within30: number;
  within60: number;
  within90: number;
};
export type Customers = {
  cohorts: { cohorts: Cohort[]; average: { month: number; rate: number }[] };
  rfm: {
    referenceDate: string | null;
    totalCustomers: number;
    totalRevenue: number;
    segments: RfmSegment[];
    grid: { r: number; cells: number[] }[];
  };
  repeatInterval: { allRepeatOrders: IntervalSummary; firstToSecond: IntervalSummary };
};

export type ProductRow = {
  productId: string;
  name: string;
  category: string;
  price: number;
  photo: string;
  stock: number;
  views: number;
  addToCarts: number;
  addToCartRate: number;
  orders: number;
  viewToOrderRate: number;
  units: number;
  revenue: number;
  returnRate: number;
  daysOfCover: number | null;
  rank: number;
  revenueShare: number;
  cumulativeShare: number;
  abcClass: "A" | "B" | "C";
  alert: string | null;
};
export type Products = {
  range: Range;
  totalRevenue: number;
  classes: { abcClass: string; products: number; revenueShare: number }[];
  products: ProductRow[];
};

export type MethodStats = {
  method: "COD" | "ONLINE";
  orders: number;
  orderShare: number;
  gmv: number;
  aov: number;
  cancellationRate: number;
  rtoRate: number;
  returnRate: number;
  lostOrderRate: number;
  lostGmv: number;
  avgHoursToShip: number | null;
  avgDaysToDeliver: number | null;
};
export type Payments = {
  range: Range;
  totalOrders: number;
  byMethod: MethodStats[];
  timeline: { status: string; orders: number; avgDaysFromOrder: number | null }[];
  cities: {
    city: string;
    state: string;
    orders: number;
    codShare: number;
    codRtoRate: number;
    prepaidRtoRate: number;
    codRtoOrders: number;
    estCodRtoCost: number;
  }[];
  rtoCostAssumption: number;
};

export type SearchTerm = {
  term: string;
  searches: number;
  zeroResultSearches: number;
  zeroResultRate: number;
  sessions: number;
  convertingSessions: number;
  searchToPurchaseRate: number;
  shareOfSearches: number;
};
export type Search = {
  range: Range;
  totalSearches: number;
  zeroResultRate: number;
  topSearches: SearchTerm[];
  zeroResultTerms: SearchTerm[];
  conversionBySearch: { behaviour: string; sessions: number; sessionShare: number; conversionRate: number }[];
};

export type CouponRow = {
  code: string;
  orders: number;
  shareOfAllOrders: number;
  applySessions: number;
  redemptionRate: number;
  discountCost: number;
  avgDiscount: number;
  gmv: number;
  aov: number;
  incrementalAov: number;
  gmvPerRupeeDiscount: number;
  cancellationRate: number;
};
export type Coupons = { range: Range; aovWithoutCoupon: number; couponOrderShare: number; coupons: CouponRow[] };

export type VariantStats = {
  variant: "control" | "treatment";
  label: string;
  exposedSessions: number;
  convertedSessions: number;
  conversionRate: number;
  orders: number;
  aov: number;
  revenue: number;
  revenuePerSession: number;
  cancellationRate: number;
};
type Interval = [number, number];
export type ProportionTest = {
  controlRate: number;
  treatmentRate: number;
  absoluteLift: number;
  relativeLift: number;
  z: number;
  pValue: number;
  ci95: Interval;
};
export type MeanTest = {
  controlMean: number;
  treatmentMean: number;
  absoluteLift: number;
  relativeLift: number;
  t: number;
  df: number;
  pValue: number;
  ci95: Interval;
};
export type ExperimentInfo = {
  key: string;
  name: string;
  hypothesis: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  guardrail: string;
  status: "running" | "stopped";
  startedAt: string | null;
  stoppedAt: string | null;
  simulated?: boolean;
  variants: Record<"control" | "treatment", { label: string }>;
};
export type ExperimentResults = {
  experiment: ExperimentInfo;
  variants: VariantStats[];
  tests: { conversion: ProportionTest; aov: MeanTest; revenuePerSession: MeanTest; cancellation: ProportionTest };
  srm: { chi2: number; pValue: number; mismatch: boolean };
  power: { minimumDetectableEffect: number; requiredPerArm: number; samplePerArm: number };
  verdict: { decision: "ship" | "dont_ship" | "keep_running" | "investigate"; headline: string; reasons: string[] };
  daily: { days: string[]; control: number[]; treatment: number[] };
};
