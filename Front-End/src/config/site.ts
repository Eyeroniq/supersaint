// Storefront copy and navigation. Edit here to change text across the site.

export const SITE = {
  name: "Super Saint",
  tagline: "Supporting real body positivity by designing for change, not just a moment.",
  heroTitle: "DEATH OVER AVERAGE",
  heroSubtitle: "Fitted essentials engineered for the body you're building.",
  whatsapp: "+91 8000399480",
  email: "support@supersaint.co",
  instagram: "https://www.instagram.com/",
};

export const ANNOUNCEMENTS = [
  "FREE 7 DAY EXCHANGE POLICY",
  "FREE SHIPPING ON ALL PREPAID ORDERS",
];

export const MENU_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/pages/about-us" },
  { label: "Shop Us", to: "/collections/all" },
  { label: "Track Order", to: "/track-order" },
  { label: "Contact", to: "/pages/contact" },
];

export const SUPPORT_LINKS = [
  { label: "Track Order", to: "/track-order" },
  { label: "Pre Order T&C", to: "/pages/pre-order-terms" },
  { label: "Exchange/Return Order", to: "/pages/exchange-return" },
  { label: "Contact", to: "/pages/contact" },
];

export const POLICY_LINKS = [
  { label: "Exchange Policy", to: "/pages/exchange-policy" },
  { label: "Pre Order T&C", to: "/pages/pre-order-terms" },
  { label: "Shipping Policy", to: "/pages/shipping-policy" },
  { label: "Privacy Policy", to: "/pages/privacy-policy" },
  { label: "Terms of Service", to: "/pages/terms-of-service" },
  { label: "Cancellation Policy", to: "/pages/cancellation-policy" },
  { label: "Return & Refund", to: "/pages/return-refund" },
  { label: "Contact Information", to: "/pages/contact" },
  { label: "Creator Collaboration Program", to: "/pages/creator-program" },
  { label: "Careers", to: "/pages/careers" },
];

export const FAQS = [
  {
    q: "Do you ship overseas?",
    a: "Right now we ship across India only. International shipping is on the way. Follow us on Instagram to hear first.",
  },
  {
    q: "How long will it take to get my order?",
    a: "Orders are dispatched within 24–48 hours and usually arrive in 3–7 business days depending on your pin code.",
  },
  {
    q: "Do you offer full refunds?",
    a: "We offer a free 7 day exchange on every order. Refunds are issued for damaged or incorrect items. See our Return & Refund policy for details.",
  },
  {
    q: "How do your products fit?",
    a: "Our essentials are fitted through the chest and arms with a relaxed midsection. If you're between sizes or prefer a looser feel, size up.",
  },
];

export const PRODUCT_ACCORDIONS = [
  {
    title: "Quality Guarantee",
    body: "Every piece is pre-washed and pre-shrunk, and quality-checked before it ships. If anything isn't right, we'll exchange it within 7 days, free.",
  },
  {
    title: "Shipping & Exchange",
    body: "Free shipping on all prepaid orders. Cash on Delivery available across India. Free 7 day exchange on all orders.",
  },
];

type Page = { title: string; body: string[] };

export const PAGES: Record<string, Page> = {
  "about-us": {
    title: "About Us",
    body: [
      "Super Saint makes fitted essentials for people who show up every day. We design for change: for the body you have today and the one you're building.",
      "Every tee, tank and layer is cut to flatter real bodies, made from soft, stretch-forward fabric, and pre-shrunk so the fit lasts.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      `WhatsApp: ${SITE.whatsapp}`,
      `Email: ${SITE.email}`,
      "Our team replies Monday to Saturday, 10am–7pm IST.",
    ],
  },
  "exchange-policy": {
    title: "Exchange Policy",
    body: [
      "All orders are eligible for a free exchange within 7 days of delivery.",
      "Items must be unworn, unwashed and returned with original tags and packaging.",
    ],
  },
  "exchange-return": {
    title: "Exchange / Return Order",
    body: [
      `To start an exchange or return, message us on WhatsApp at ${SITE.whatsapp} or email ${SITE.email} with your order ID.`,
    ],
  },
  "pre-order-terms": {
    title: "Pre Order T&C",
    body: [
      "Pre-order items ship on the estimated date shown on the product page. Dates may shift slightly; we'll keep you posted by email.",
    ],
  },
  "shipping-policy": {
    title: "Shipping Policy",
    body: [
      "Free shipping on all prepaid orders. A small fee applies to Cash on Delivery orders below the free shipping threshold.",
      "Orders are dispatched within 24–48 hours and delivered in 3–7 business days.",
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    body: [
      "We collect only the information needed to process your orders and improve your experience. We never sell your personal data.",
    ],
  },
  "terms-of-service": {
    title: "Terms of Service",
    body: [
      "By using this site you agree to our terms of purchase, our policies and applicable law. Prices and availability may change without notice.",
    ],
  },
  "cancellation-policy": {
    title: "Cancellation Policy",
    body: [
      "Orders can be cancelled before they are dispatched. Contact us with your order ID as soon as possible.",
    ],
  },
  "return-refund": {
    title: "Return & Refund",
    body: [
      "Refunds are issued for damaged, defective or incorrect items. Approved refunds are processed to the original payment method within 5–7 business days.",
    ],
  },
  "creator-program": {
    title: "Creator Collaboration Program",
    body: [
      `Are you a creator who lives the Super Saint mindset? Email ${SITE.email} with your handle and we'll be in touch.`,
    ],
  },
  careers: {
    title: "Careers",
    body: [`We're always looking for driven people. Send your CV to ${SITE.email}.`],
  },
};
