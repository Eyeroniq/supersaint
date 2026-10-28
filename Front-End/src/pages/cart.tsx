import { PiHandbag, PiLockSimple } from "react-icons/pi";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { ShippingProgress } from "../components/store/cart-drawer";
import CartLine from "../components/store/cart-line";
import { RootState } from "../redux/store";
import { formatPrice } from "../utils/format";

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, subtotal, shippingCharges, discount, total } = useSelector(
    (state: RootState) => state.cartReducer
  );

  if (!cartItems.length)
    return (
      <div className="section cart-empty cart-empty--page">
        <PiHandbag />
        <h1 className="section-title">Your cart is empty</h1>
        <Link to="/collections/all" className="btn btn--dark">
          Continue shopping
        </Link>
      </div>
    );

  return (
    <div className="cart-page section">
      <h1 className="section-title">Your Cart</h1>
      <div className="checkout__grid">
        <div className="card">
          <ShippingProgress subtotal={subtotal} />
          {cartItems.map((item) => (
            <CartLine key={item.productId + (item.size || "")} item={item} />
          ))}
        </div>
        <aside className="card checkout__summary">
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{shippingCharges ? formatPrice(shippingCharges) : "FREE"}</dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>Discount</dt>
                <dd>− {formatPrice(discount)}</dd>
              </div>
            )}
            <div className="totals__grand">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <p className="muted small">Taxes included. Discount codes can be added at checkout.</p>
          <button className="btn btn--dark btn--block btn--lg" onClick={() => navigate("/checkout")}>
            <PiLockSimple /> Proceed to Checkout
          </button>
          <Link to="/collections/all" className="link-btn center">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
};

export default Cart;
