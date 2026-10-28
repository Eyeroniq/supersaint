import axios from "axios";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PiLockSimple } from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShippingProgress } from "../components/store/cart-drawer";
import { authHeaders } from "../redux/api/baseQuery";
import { useNewOrderMutation } from "../redux/api/orderAPI";
import { discountApplied, resetCart, saveShippingInfo } from "../redux/reducer/cartReducer";
import { RootState, server } from "../redux/store";
import { NewOrderRequest } from "../types/api-types";
import { ShippingInfo } from "../types/types";
import { formatPrice, photoUrl } from "../utils/format";

const errorMessage = (e: unknown, fallback: string) =>
  axios.isAxiosError(e) ? e.response?.data?.message ?? fallback : fallback;

type PayMethod = "COD" | "ONLINE";

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (r: { error: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

// Loads Razorpay's hosted checkout (UPI, cards, netbanking, wallets) once
const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const Checkout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.userReducer);
  const cart = useSelector((state: RootState) => state.cartReducer);
  const { cartItems, subtotal, shippingCharges, discount, couponCode, shippingInfo } = cart;
  const [newOrder] = useNewOrderMutation();

  const [form, setForm] = useState<ShippingInfo>({
    ...shippingInfo,
    name: shippingInfo.name || user?.name || "",
    phone: shippingInfo.phone || user?.phone || "",
  });
  const [method, setMethod] = useState<PayMethod>("COD");
  const [coupon, setCoupon] = useState(couponCode);
  const [placing, setPlacing] = useState(false);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  // Set once an order succeeds so clearing the cart doesn't bounce us to /cart
  const placedRef = useRef(false);

  useEffect(() => {
    axios
      .get(`${server}/api/v1/payment/config`)
      .then(({ data }) => setOnlineEnabled(Boolean(data.online)))
      .catch(() => setOnlineEnabled(false));
  }, []);

  if (!cartItems.length && !placedRef.current) return <Navigate to="/cart" replace />;

  // Prepaid orders ship free; the server applies the same rule
  const shipping = method === "ONLINE" ? 0 : shippingCharges;
  const total = Math.max(subtotal + shipping - discount, 0);

  const change = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code) return;
    try {
      const { data } = await axios.get(`${server}/api/v1/payment/discount`, {
        params: { coupon: code },
      });
      dispatch(discountApplied({ code, amount: data.discount }));
      toast.success(`Coupon applied: ${formatPrice(data.discount)} off`);
    } catch (e) {
      dispatch(discountApplied({ code: "", amount: 0 }));
      toast.error(errorMessage(e, "Invalid coupon code"));
    }
  };

  const placeOrder = async (razorpay?: NewOrderRequest["razorpay"]) => {
    const order: NewOrderRequest = {
      shippingInfo: form,
      orderItems: cartItems,
      coupon: couponCode || undefined,
      paymentMethod: razorpay ? "ONLINE" : "COD",
      razorpay,
    };
    setPlacing(true);
    const res = await newOrder(order);
    setPlacing(false);
    if ("data" in res && res.data) {
      placedRef.current = true;
      navigate(`/order/${res.data.orderId}?placed=1`, { replace: true });
      dispatch(resetCart());
      toast.success("Order placed successfully");
    } else {
      const err = (res as { error?: { data?: { message?: string } } }).error;
      toast.error(err?.data?.message || "Could not place order");
    }
  };

  const payOnline = async () => {
    setPlacing(true);
    try {
      const [loaded, { data }] = await Promise.all([
        loadRazorpay(),
        axios.post(
          `${server}/api/v1/payment/razorpay/order`,
          { orderItems: cartItems, coupon: couponCode || undefined },
          { headers: authHeaders() }
        ),
      ]);
      if (!loaded || !window.Razorpay) throw new Error("Could not load the payment window");

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: "Super Saint",
        description: `${cartItems.reduce((n, i) => n + i.quantity, 0)} item(s)`,
        prefill: { name: form.name, email: user?.email, contact: form.phone },
        theme: { color: "#111111" },
        handler: (r: RazorpayResponse) =>
          placeOrder({
            orderId: r.razorpay_order_id,
            paymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          }),
        modal: {
          ondismiss: () => {
            setPlacing(false);
            toast("Payment cancelled");
          },
        },
      });
      rzp.on("payment.failed", (r) => toast.error(r.error.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      setPlacing(false);
      toast.error(errorMessage(e, e instanceof Error ? e.message : "Online payment is unavailable"));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, "").slice(-10)))
      return toast.error("Please enter a valid 10-digit phone number");
    if (!/^\d{6}$/.test(String(form.pinCode))) return toast.error("Please enter a valid 6-digit PIN code");
    dispatch(saveShippingInfo(form));

    if (method === "COD") return placeOrder();
    return payOnline();
  };

  return (
    <div className="checkout section">
      <h1 className="section-title">Checkout</h1>
      <div className="checkout__grid">
        <div className="checkout__main">
          <form onSubmit={submit} className="checkout__form">
            <section className="card">
              <h2>Contact</h2>
              <p className="muted small">Logged in as {user?.email}</p>
              <label className="field">
                <span>Phone number</span>
                <input name="phone" type="tel" inputMode="tel" required value={form.phone} onChange={change} placeholder="10-digit mobile number" />
              </label>
            </section>

            <section className="card">
              <h2>Delivery</h2>
              <label className="field">
                <span>Full name</span>
                <input name="name" required value={form.name} onChange={change} />
              </label>
              <label className="field">
                <span>Address</span>
                <input name="address" required value={form.address} onChange={change} placeholder="House no., street, area" />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>City</span>
                  <input name="city" required value={form.city} onChange={change} />
                </label>
                <label className="field">
                  <span>State</span>
                  <input name="state" required value={form.state} onChange={change} />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>PIN code</span>
                  <input name="pinCode" required inputMode="numeric" maxLength={6} value={form.pinCode} onChange={change} />
                </label>
                <label className="field">
                  <span>Country</span>
                  <select name="country" value={form.country} onChange={change}>
                    <option value="India">India</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="card">
              <h2>Payment</h2>
              <label className={`pay-option ${method === "ONLINE" ? "is-active" : ""} ${onlineEnabled ? "" : "is-disabled"}`}>
                <input
                  type="radio"
                  name="pay"
                  disabled={!onlineEnabled}
                  checked={method === "ONLINE"}
                  onChange={() => setMethod("ONLINE")}
                />
                <span>
                  <strong>Pay online · UPI, cards, netbanking</strong>
                  <small>
                    {onlineEnabled
                      ? "GPay, PhonePe, Paytm & more via Razorpay · Free shipping"
                      : "Not available yet"}
                  </small>
                </span>
              </label>
              <label className={`pay-option ${method === "COD" ? "is-active" : ""}`}>
                <input type="radio" name="pay" checked={method === "COD"} onChange={() => setMethod("COD")} />
                <span>
                  <strong>Cash on Delivery</strong>
                  <small>Pay when your order arrives</small>
                </span>
              </label>
            </section>

            <button className="btn btn--dark btn--block btn--lg" disabled={placing}>
              <PiLockSimple />{" "}
              {placing
                ? "Please wait…"
                : method === "COD"
                  ? `Place order · ${formatPrice(total)}`
                  : `Pay ${formatPrice(total)}`}
            </button>
          </form>
        </div>

        <aside className="checkout__summary card">
          <h2>Order summary</h2>
          {cartItems.map((i) => (
            <div key={i.productId + (i.size || "")} className="summary-line">
              <span className="summary-line__img">
                <img src={photoUrl(i.photo)} alt="" />
                <em>{i.quantity}</em>
              </span>
              <span className="summary-line__name">
                {i.name}
                {i.size && <small>Size: {i.size}</small>}
              </span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </div>
          ))}

          <div className="coupon">
            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Discount code" aria-label="Discount code" />
            <button type="button" className="btn btn--outline" onClick={applyCoupon}>
              Apply
            </button>
          </div>

          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{shipping ? formatPrice(shipping) : "FREE"}</dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>Discount{couponCode ? ` (${couponCode})` : ""}</dt>
                <dd>− {formatPrice(discount)}</dd>
              </div>
            )}
            <div className="totals__grand">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <p className="muted small">Taxes included.</p>
          <ShippingProgress subtotal={subtotal} />
          <Link to="/cart" className="link-btn">
            Edit cart
          </Link>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
