import { MouseEvent, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PiCaretLeft, PiCaretRight, PiMinus, PiPlus, PiRuler, PiStarFill } from "react-icons/pi";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import Accordion from "../components/store/accordion";
import Drawer from "../components/store/drawer";
import ProductCard from "../components/store/product-card";
import Reveal from "../components/store/reveal";
import { PRODUCT_ACCORDIONS } from "../config/site";
import {
  useLatestProductsQuery,
  useProductDetailsQuery,
  useSearchProductsQuery,
} from "../redux/api/productAPI";
import { addToCart } from "../redux/reducer/cartReducer";
import { setCartOpen } from "../redux/reducer/uiReducer";
import { baseName, formatPrice, photoUrl, savePercent } from "../utils/format";

const SIZE_CHART = [
  ["S", "36", "26"],
  ["M", "38", "27"],
  ["L", "40", "28"],
  ["XL", "42", "29"],
  ["2XL", "44", "30"],
];

const ProductPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data, isLoading, isError } = useProductDetailsQuery(id);
  const product = data?.product;

  // Products sharing a base name ("Everyday Fitted Tee - Navy") act as colour variants
  const { data: siblings } = useSearchProductsQuery(
    { search: product ? baseName(product) : "", page: 1, price: 0, sort: "", category: "" },
    { skip: !product }
  );
  const { data: latest } = useLatestProductsQuery("");

  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSize(product?.sizes?.[0] ?? "");
    setQty(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [product?._id]);

  if (isError)
    return (
      <div className="section center empty-state">
        <h1 className="section-title">Product not found</h1>
        <Link to="/collections/all" className="btn btn--dark">
          Back to shop
        </Link>
      </div>
    );

  if (isLoading || !product)
    return (
      <div className="pdp section">
        <div className="pdp__media shimmer" />
        <div className="pdp__info">
          <div className="shimmer shimmer--line" />
          <div className="shimmer shimmer--line short" />
        </div>
      </div>
    );

  const save = savePercent(product.price, product.comparePrice);
  const soldOut = product.stock < 1;
  const variants =
    siblings?.products.filter((p) => baseName(p) === baseName(product) && p.name.includes(" - ")) ?? [];
  const related = (latest?.products ?? []).filter((p) => p._id !== product._id);

  const add = (goToCheckout = false) => {
    if (soldOut) return;
    if (product.sizes?.length && !size) return toast.error("Please select a size");
    dispatch(
      addToCart({
        productId: product._id,
        name: product.name,
        photo: product.photo,
        price: product.price,
        comparePrice: product.comparePrice,
        stock: product.stock,
        size: size || undefined,
        quantity: qty,
      })
    );
    if (goToCheckout) navigate("/checkout");
    else dispatch(setCartOpen(true));
  };

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ on: true, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const scrollCarousel = (dir: number) =>
    carouselRef.current?.scrollBy({ left: dir * carouselRef.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="pdp-page">
      <section className="pdp section">
        <div
          className={`pdp__media ${zoom.on ? "is-zoomed" : ""}`}
          onMouseMove={onMove}
          onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))}
        >
          <img
            key={product._id}
            src={photoUrl(product.photo)}
            alt={product.name}
            style={{ transformOrigin: `${zoom.x}% ${zoom.y}%` }}
          />
          {save > 0 && !soldOut && <span className="badge">SAVE {save}%</span>}
          {soldOut && <span className="badge badge--dark">Sold out</span>}
        </div>

        <div className="pdp__info">
          <h1 className="pdp__title">{product.name}</h1>

          {!!product.numReviews && (
            <p className="pdp__rating">
              {Array.from({ length: 5 }, (_, i) => (
                <PiStarFill key={i} />
              ))}
              <span>({product.numReviews.toLocaleString("en-IN")})</span>
            </p>
          )}

          <p className="pdp__price">
            <span>{formatPrice(product.price)}</span>
            {save > 0 && <s>{formatPrice(product.comparePrice!)}</s>}
          </p>
          <p className="muted small">Taxes included.</p>

          {!!product.sizes?.length && (
            <div className="pdp__option">
              <div className="pdp__option-head">
                <span>
                  Size - <strong>{size || "Select"}</strong>
                </span>
                <button className="link-btn" onClick={() => setChartOpen(true)}>
                  <PiRuler /> Sizing chart
                </button>
              </div>
              <div className="size-grid">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    className={`size-btn ${size === s ? "is-active" : ""}`}
                    disabled={soldOut}
                    onClick={() => setSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {variants.length > 1 && (
            <div className="pdp__option">
              <span>
                Color - <strong>{product.color || product.name.split(" - ")[1]}</strong>
              </span>
              <div className="swatches">
                {variants.map((v) => (
                  <Link
                    key={v._id}
                    to={`/products/${v._id}`}
                    className={`swatch ${v._id === product._id ? "is-active" : ""}`}
                    title={v.name.split(" - ")[1]}
                  >
                    <img src={photoUrl(v.photo)} alt={v.name} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!soldOut && (
            <div className="pdp__option">
              <span>Quantity</span>
              <div className="qty qty--lg">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                  <PiMinus />
                </button>
                <span>{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  disabled={qty >= product.stock}
                  aria-label="Increase quantity"
                >
                  <PiPlus />
                </button>
              </div>
            </div>
          )}

          <div className="pdp__actions">
            <button className="btn btn--dark btn--block btn--lg" disabled={soldOut} onClick={() => add()}>
              {soldOut ? "SOLD OUT" : "ADD TO CART"}
            </button>
            {!soldOut && (
              <button className="btn btn--outline btn--block btn--lg" onClick={() => add(true)}>
                BUY IT NOW
              </button>
            )}
          </div>

          <div className="pdp__accordions">
            <Accordion title="Product Details" defaultOpen>
              <p>{product.description || "Premium Super Saint essential."}</p>
            </Accordion>
            {PRODUCT_ACCORDIONS.map((a) => (
              <Accordion key={a.title} title={a.title}>
                <p>{a.body}</p>
              </Accordion>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section">
          <Reveal as="h2" className="section-title">
            BEST SELLERS
          </Reveal>
          <div className="carousel">
            <button className="carousel__arrow left" onClick={() => scrollCarousel(-1)} aria-label="Previous">
              <PiCaretLeft />
            </button>
            <div className="carousel__track" ref={carouselRef}>
              {related.map((p) => (
                <div className="carousel__item" key={p._id}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            <button className="carousel__arrow right" onClick={() => scrollCarousel(1)} aria-label="Next">
              <PiCaretRight />
            </button>
          </div>
          <div className="center">
            <Link to="/collections/all" className="btn btn--dark">
              View all
            </Link>
          </div>
        </section>
      )}

      <Drawer open={chartOpen} onClose={() => setChartOpen(false)} side="right" title="Sizing chart">
        <div className="size-chart">
          <table>
            <thead>
              <tr>
                <th>Size</th>
                <th>Chest (in)</th>
                <th>Length (in)</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART.map((row) => (
                <tr key={row[0]}>
                  {row.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Fitted through chest and arms. Between sizes? Size up for a relaxed feel.</p>
        </div>
      </Drawer>
    </div>
  );
};

export default ProductPage;
