import { PiHandbag, PiLockSimple, PiTruck } from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useLatestProductsQuery } from "../../redux/api/productAPI";
import { FREE_SHIPPING_THRESHOLD } from "../../redux/reducer/cartReducer";
import { setCartOpen } from "../../redux/reducer/uiReducer";
import { RootState } from "../../redux/store";
import { formatPrice, photoUrl } from "../../utils/format";
import CartLine from "./cart-line";
import Drawer from "./drawer";

export const ShippingProgress = ({ subtotal }: { subtotal: number }) => {
  const left = FREE_SHIPPING_THRESHOLD - subtotal;
  const pct = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  return (
    <div className="ship-progress">
      <p>
        <PiTruck />
        {left > 0 ? (
          <>
            You're <strong>{formatPrice(left)}</strong> away from free shipping
          </>
        ) : (
          <>You've unlocked <strong>free shipping</strong></>
        )}
      </p>
      <div className="ship-progress__bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const CartDrawer = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector((state: RootState) => state.uiReducer.cartOpen);
  const { cartItems, subtotal, discount, total } = useSelector(
    (state: RootState) => state.cartReducer
  );
  const { data } = useLatestProductsQuery("", { skip: !open });
  const close = () => dispatch(setCartOpen(false));

  const inCart = new Set(cartItems.map((i) => i.productId));
  const suggestions = (data?.products ?? []).filter((p) => !inCart.has(p._id) && p.stock > 0).slice(0, 6);
  const count = cartItems.reduce((n, i) => n + i.quantity, 0);

  const checkout = () => {
    close();
    navigate("/checkout");
  };

  return (
    <Drawer open={open} onClose={close} side="right" title={`Your Cart${count ? ` (${count})` : ""}`} className="cart-drawer">
      {cartItems.length === 0 ? (
        <div className="cart-empty">
          <PiHandbag />
          <p>Your cart is empty</p>
          <Link to="/collections/all" className="btn btn--dark" onClick={close}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-drawer__body">
            <ShippingProgress subtotal={subtotal} />
            <div className="cart-drawer__lines">
              {cartItems.map((item) => (
                <CartLine key={item.productId + (item.size || "")} item={item} onNavigate={close} />
              ))}
            </div>

            {suggestions.length > 0 && (
              <section className="cart-suggest">
                <h3>You may also like</h3>
                <div className="cart-suggest__row">
                  {suggestions.map((p) => (
                    <Link key={p._id} to={`/products/${p._id}`} onClick={close} className="cart-suggest__item">
                      <img src={photoUrl(p.photo)} alt="" />
                      <span>{p.name}</span>
                      <strong>{formatPrice(p.price)}</strong>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <footer className="cart-drawer__foot">
            {discount > 0 && (
              <p className="cart-drawer__total muted">
                <span>Discount</span>
                <span>− {formatPrice(discount)}</span>
              </p>
            )}
            <p className="cart-drawer__total">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </p>
            <p className="muted small">Taxes included. Shipping calculated at checkout.</p>
            <button className="btn btn--dark btn--block" onClick={checkout}>
              <PiLockSimple /> Proceed to Checkout
            </button>
            <Link to="/cart" className="link-btn center" onClick={close}>
              View cart
            </Link>
          </footer>
        </>
      )}
    </Drawer>
  );
};

export default CartDrawer;
