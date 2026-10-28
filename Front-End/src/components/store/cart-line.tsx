import { PiMinus, PiPlus, PiTrash } from "react-icons/pi";
import { useDispatch } from "react-redux";
import { useTrack } from "../../analytics/useTrack";
import { Link } from "react-router-dom";
import { removeCartItem, setQuantity } from "../../redux/reducer/cartReducer";
import { CartItem } from "../../types/types";
import { formatPrice, photoUrl } from "../../utils/format";

const CartLine = ({ item, onNavigate }: { item: CartItem; onNavigate?: () => void }) => {
  const dispatch = useDispatch();
  const { productId, size, quantity, stock } = item;
  const { track } = useTrack();
  const removed = () => track("remove_from_cart", { product_id: productId, metadata: { size: size ?? null } });
  const set = (q: number) => {
    if (q < 1) removed();
    dispatch(setQuantity({ productId, size, quantity: q }));
  };

  return (
    <div className="cart-line">
      <Link to={`/products/${productId}`} onClick={onNavigate} className="cart-line__img">
        <img src={photoUrl(item.photo)} alt={item.name} />
      </Link>
      <div className="cart-line__info">
        <Link to={`/products/${productId}`} onClick={onNavigate} className="cart-line__name">
          {item.name}
        </Link>
        {size && <p className="muted">Size: {size}</p>}
        <div className="cart-line__row">
          <div className="qty">
            <button onClick={() => set(quantity - 1)} aria-label="Decrease quantity">
              <PiMinus />
            </button>
            <span>{quantity}</span>
            <button onClick={() => set(quantity + 1)} disabled={quantity >= stock} aria-label="Increase quantity">
              <PiPlus />
            </button>
          </div>
          <button
            className="icon-btn icon-btn--sm"
            onClick={() => {
              removed();
              dispatch(removeCartItem({ productId, size }));
            }}
            aria-label="Remove item"
          >
            <PiTrash />
          </button>
        </div>
      </div>
      <strong className="cart-line__price">{formatPrice(item.price * quantity)}</strong>
    </div>
  );
};

export default CartLine;
