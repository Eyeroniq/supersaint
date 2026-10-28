import { PiCheckCircle } from "react-icons/pi";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useOrderDetailsQuery } from "../redux/api/orderAPI";
import { formatPrice, photoUrl } from "../utils/format";
import { StatusPill } from "./orders";

const STEPS = ["Processing", "Shipped", "Delivered"];

const OrderDetails = () => {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading, isError } = useOrderDetailsQuery(id);
  const order = data?.order;

  if (isLoading) return <div className="section"><div className="shimmer shimmer--block" /></div>;
  if (isError || !order)
    return (
      <div className="section center empty-state">
        <h1 className="section-title">Order not found</h1>
        <p className="muted">Check the order ID, or log in with the account used to place it.</p>
        <Link to="/account" className="btn btn--dark">
          My orders
        </Link>
      </div>
    );

  const step = STEPS.indexOf(order.status);
  const { shippingInfo: s } = order;

  return (
    <div className="order-page section">
      {params.get("placed") && (
        <div className="order-success card">
          <PiCheckCircle />
          <div>
            <h2>Thank you{s.name ? `, ${s.name.split(" ")[0]}` : ""}!</h2>
            <p className="muted">Your order has been placed. We'll keep you updated by email.</p>
          </div>
        </div>
      )}

      <div className="account__head">
        <div>
          <h1 className="section-title left">Order #{order._id.slice(-8).toUpperCase()}</h1>
          <p className="muted small">Full ID: {order._id}</p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <ol className="timeline">
        {STEPS.map((label, i) => (
          <li key={label} className={i <= step ? "is-done" : ""}>
            <span className="timeline__dot" />
            {label}
          </li>
        ))}
      </ol>

      <div className="checkout__grid">
        <div className="card">
          <h2>Items</h2>
          {order.orderItems.map((i) => (
            <div key={i._id} className="summary-line">
              <span className="summary-line__img">
                <img src={photoUrl(i.photo)} alt="" />
                <em>{i.quantity}</em>
              </span>
              <span className="summary-line__name">
                <Link to={`/products/${i.productId}`}>{i.name}</Link>
                {i.size && <small>Size: {i.size}</small>}
              </span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </div>
          ))}
        </div>

        <aside className="card checkout__summary">
          <h2>Delivery</h2>
          <p>
            {s.name && <strong>{s.name}<br /></strong>}
            {s.address}, {s.city}, {s.state} {s.pinCode}, {s.country}
            {s.phone && <><br />Phone: {s.phone}</>}
          </p>
          <h2>Payment</h2>
          <p>{order.paymentMethod === "ONLINE" ? "Paid online" : "Cash on Delivery"}</p>
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{order.shippingCharges ? formatPrice(order.shippingCharges) : "FREE"}</dd>
            </div>
            {order.discount > 0 && (
              <div>
                <dt>Discount</dt>
                <dd>− {formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="totals__grand">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
};

export default OrderDetails;
