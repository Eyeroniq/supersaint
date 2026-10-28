// Seeds the local database with the sample Super Saint catalog and an admin
// account (credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in .env).
// Usage: npm run seed
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

config({ path: "./.env" });

const C = {
  black: "#161616",
  white: "#f7f7f5",
  slate: "#5f6b73",
  grey: "#8d8d8d",
  charcoal: "#3c3c3c",
  mocha: "#b59a7c",
  navy: "#1d2a44",
  brown: "#5a4334",
  sand: "#d9cbb6",
  green: "#5b6a45",
};

const SIZES = ["S", "M", "L", "XL", "2XL"];

const products = [
  {
    name: "Premium Ultra-Soft Cotton Fitted Tank 3 Pack",
    price: 1799, comparePrice: 2397, stock: 40, category: "tanks",
    garment: "tank", colors: [C.white, C.slate, C.black], color: "White/Slate/Black",
  },
  {
    name: "Everyday Fitted Tee 2 Pack - Black/White",
    price: 1799, comparePrice: 1998, stock: 35, category: "tees",
    garment: "tee", colors: [C.black, C.white], color: "Black/White",
  },
  {
    name: "Premium Ultra-Soft Cotton Acid Wash Fitted Tank 2 Pack",
    price: 1799, comparePrice: 1998, stock: 25, category: "tanks",
    garment: "tank", colors: [C.grey, C.charcoal], color: "Grey/Charcoal",
  },
  {
    name: "Everyday Fitted Tee 3 Pack",
    price: 2499, comparePrice: 2997, stock: 30, category: "tees",
    garment: "tee", colors: [C.black, C.white, C.grey], color: "Black/White/Grey",
  },
  ...[["Mocha", C.mocha], ["Black", C.black], ["White", C.white], ["Slate", C.slate]].map(
    ([name, hex]) => ({
      name: `Premium Ultra-Soft Cotton Fitted Tank - ${name}`,
      price: 799, comparePrice: 0, stock: 50, category: "tanks",
      garment: "tank", colors: [hex], color: name,
    })
  ),
  ...[["Grey", C.grey], ["Navy", C.navy], ["Brown", C.brown]].map(([name, hex]) => ({
    name: `Everyday Fitted Tee - ${name}`,
    price: 999, comparePrice: 0, stock: 60, category: "tees",
    garment: "tee", colors: [hex], color: name,
  })),
  ...[["Sand", C.sand], ["Navy", C.navy], ["Cypress Green", C.green]].map(([name, hex]) => ({
    name: `Fitted Performance Quarter Zip - ${name}`,
    price: 1999, comparePrice: 2999, stock: 20, category: "quarter zips",
    garment: "zip", colors: [hex], color: name,
  })),
  {
    name: "Essential Oversized Vintage Sweatpants",
    price: 1799, comparePrice: 0, stock: 0, category: "bottoms",
    garment: "pants", colors: [C.charcoal], color: "Washed Black",
  },
  {
    name: "Core Sleeveless Athletic Tank",
    price: 999, comparePrice: 0, stock: 0, category: "tanks",
    garment: "tank", colors: [C.black], color: "Black",
  },
];

const DESCRIPTIONS = {
  tank: "SuperFlex™ premium cotton blend (92% cotton / 8% spandex). Fitted through the chest and arms with a relaxed midsection. Pre-washed and pre-shrunk so the fit you buy is the fit you keep.",
  tee: "SuperFlex™ premium cotton blend (92% cotton / 8% spandex). Fitted arms and chest, relaxed midsection, and a collar that keeps its shape wash after wash.",
  zip: "Lightweight performance knit with four-way stretch. Sculpted fit, quarter-length zip and thumb-friendly cuffs, built for training days and everything after.",
  pants: "Heavyweight brushed fleece with a vintage wash. Relaxed oversized leg, elastic waistband with drawcord and deep side pockets.",
};

const PATHS = {
  tee: "M282 160 L345 132 Q400 176 455 132 L518 160 L648 246 L596 352 L532 318 L532 842 L268 842 L268 318 L204 352 L152 246 Z",
  tank: "M298 132 L342 132 Q400 248 458 132 L502 132 Q508 270 566 330 L566 842 L234 842 L234 330 Q292 270 298 132 Z",
  zip: "M326 150 L358 112 L442 112 L474 150 L566 192 L660 640 L598 662 L534 352 L534 842 L266 842 L266 352 L202 662 L140 640 L234 192 Z",
  pants: "M262 150 L538 150 L572 860 L432 860 L400 410 L368 860 L228 860 Z",
};

const isLight = (hex) => parseInt(hex.slice(1, 3), 16) > 200;

const garment = (type, fill, transform) => {
  const ink = isLight(fill) ? "#1a1a1a" : "#f2f2f2";
  const extras = {
    zip: `<line x1="400" y1="116" x2="400" y2="330" stroke="${ink}" stroke-opacity=".45" stroke-width="4"/>`,
    pants: `<rect x="262" y="150" width="276" height="34" fill="#000" fill-opacity=".12"/>`,
  }[type] || "";
  return `<g transform="${transform}">
    <path d="${PATHS[type]}" fill="${fill}" stroke="#000" stroke-opacity=".08" stroke-width="3"/>
    <path d="${PATHS[type]}" fill="url(#shade)"/>
    ${extras}
    <text x="400" y="${type === "pants" ? 240 : 230}" font-family="Arial Black, Arial, sans-serif" font-size="13" letter-spacing="1.5" fill="${ink}" fill-opacity=".7" text-anchor="middle">SUPER SAINT</text>
  </g>`;
};

const svg = ({ garment: type, colors }) => {
  const n = colors.length;
  const layers = colors
    .map((fill, i) => {
      if (n === 1) return garment(type, fill, "translate(0 40)");
      const scale = 0.74;
      const step = 150;
      const x = 400 - (800 * scale) / 2 + (i - (n - 1) / 2) * step;
      const y = 120 + (n - 1 - i) * 60 - (n === 2 ? 0 : 20);
      return garment(type, fill, `translate(${x} ${y}) scale(${scale})`);
    })
    .reverse()
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".14"/>
      <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".12"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="#f4f4f2"/>
  ${layers}
</svg>`;
};

const ProductModel = mongoose.model(
  "Product",
  new mongoose.Schema(
    {
      name: String, photo: String, price: Number, stock: Number, category: String,
      comparePrice: Number, description: String, sizes: [String], color: String,
      rating: Number, numReviews: Number,
    },
    { timestamps: true }
  )
);

const UserModel = mongoose.model(
  "User",
  new mongoose.Schema(
    { _id: String, name: String, email: String, password: String, role: String, photo: String },
    { timestamps: true }
  )
);

await mongoose.connect(process.env.MONGO_URI, { dbName: "Ecommerce_24" });

fs.mkdirSync("uploads", { recursive: true });

await ProductModel.deleteMany({ photo: /^uploads\/seed-/ });
for (const f of fs.readdirSync("uploads")) if (f.startsWith("seed-")) fs.rmSync(`uploads/${f}`);

// Insert in reverse so the first item in the list is the newest ("latest")
for (const [i, p] of [...products.entries()].reverse()) {
  const photo = `uploads/seed-${i + 1}.svg`;
  fs.writeFileSync(photo, svg(p));
  await ProductModel.create({
    name: p.name,
    price: p.price,
    comparePrice: p.comparePrice,
    stock: p.stock,
    category: p.category,
    color: p.color,
    sizes: SIZES,
    description: DESCRIPTIONS[p.garment],
    rating: 0,
    numReviews: 0,
    photo,
  });
  await new Promise((r) => setTimeout(r, 5));
}
console.log(`Seeded ${products.length} products`);

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const email = ADMIN_EMAIL.toLowerCase();
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existing = await UserModel.findOne({ email });
  if (existing) await UserModel.updateOne({ email }, { password, role: "admin" });
  else
    await UserModel.create({ _id: uuid(), name: "Admin", email, password, role: "admin", photo: "" });
  console.log(`Admin account ready: ${email} (password in .env)`);
}

await mongoose.disconnect();
