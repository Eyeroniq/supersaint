import { Link } from "react-router-dom";
import { Product } from "../../types/types";
import { formatPrice, photoUrl, savePercent } from "../../utils/format";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { _id, name, photo, price, comparePrice, stock } = product;
  const save = savePercent(price, comparePrice);
  const soldOut = stock < 1;

  return (
    <Link to={`/products/${_id}`} className="product-tile">
      <div className="product-tile__media">
        <img src={photoUrl(photo)} alt={name} loading="lazy" />
        {soldOut ? (
          <span className="badge badge--dark">Sold out</span>
        ) : save > 0 ? (
          <span className="badge">SAVE {save}%</span>
        ) : null}
      </div>
      <h3 className="product-tile__title">{name}</h3>
      <p className="product-tile__price">
        <span>{formatPrice(price)}</span>
        {save > 0 && <s>{formatPrice(comparePrice!)}</s>}
      </p>
    </Link>
  );
};

export const ProductTileSkeleton = () => (
  <div className="product-tile product-tile--skeleton" aria-hidden>
    <div className="product-tile__media shimmer" />
    <div className="shimmer shimmer--line" />
    <div className="shimmer shimmer--line short" />
  </div>
);

export default ProductCard;
