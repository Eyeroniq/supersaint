# Super Saint
Full stack e-commerce store for Super Saint fitted essentials, with an admin dashboard. (TypeScript + MERN)

## Tech Stack
FrontEnd - TypeScript, React, Redux Toolkit (RTK Query), Sass

BackEnd - TypeScript, Node.js, Express, MongoDB (Mongoose), JWT auth (bcrypt-hashed passwords)

Payments - Razorpay (UPI, cards, netbanking, wallets) and Cash on Delivery

## Run locally

1. Start MongoDB on `mongodb://127.0.0.1:27017`.
2. Backend:
   ```bash
   cd Backend
   cp .env.example .env      # set JWT_SECRET and ADMIN_PASSWORD
   npm install
   npm run build
   npm run seed              # sample catalog + admin account from .env
   npm start                 # http://localhost:4000
   ```
3. Frontend:
   ```bash
   cd Front-End
   cp .env.example .env
   npm install
   npm run dev               # http://localhost:5173
   ```

Log in as the admin from `Backend/.env` and open **Menu → Admin Dashboard** to manage products, orders, customers and coupons.

### Online payments: UPI, cards, netbanking (optional)
Payments go through [Razorpay](https://razorpay.com). Copy the Key ID and Key Secret from Razorpay Dashboard → Account & Settings → API Keys (test keys start with `rzp_test_`) into `Backend/.env`:
```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```
Restart the backend. Checkout will then offer "Pay online" (prepaid orders ship free). Without keys it offers Cash on Delivery only. Order totals are always calculated on the server, and payments are checked against Razorpay's signature before an order is created.

## Storefront
- Scrolling announcement bar, sticky header, slide-in menu, live search and cart drawer with free-shipping progress
- Collection page with filter and sort (category, price, sort), product pages with sizes, colour variants, size chart and accordions
- Email/password accounts, order history, order tracking with a status timeline
- Store copy, navigation, FAQs and policy pages live in `Front-End/src/config/site.ts`

## API auth
`POST /api/v1/user/register` and `POST /api/v1/user/login` return a JWT. Send it as `Authorization: Bearer <token>`. Admin routes check the token's user has `role: "admin"`.
