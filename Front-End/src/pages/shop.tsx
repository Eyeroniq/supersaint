import { useEffect, useState } from "react";
import { PiSlidersHorizontal } from "react-icons/pi";
import { useSearchParams } from "react-router-dom";
import Drawer from "../components/store/drawer";
import ProductCard, { ProductTileSkeleton } from "../components/store/product-card";
import Reveal from "../components/store/reveal";
import { useCategoriesQuery, useSearchProductsQuery } from "../redux/api/productAPI";
import { formatPrice } from "../utils/format";

const MAX_PRICE = 5000;
const SORTS = [
  { value: "", label: "Featured" },
  { value: "asc", label: "Price, low to high" },
  { value: "dsc", label: "Price, high to low" },
];

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const Shop = () => {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "";
  const price = Number(params.get("price")) || MAX_PRICE;
  const page = Number(params.get("page")) || 1;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPrice, setDraftPrice] = useState(price);
  useEffect(() => setDraftPrice(price), [price]);

  const { data: cats } = useCategoriesQuery("");
  const { data, isLoading, isFetching, isError } = useSearchProductsQuery({
    search,
    category,
    sort,
    price: price < MAX_PRICE ? price : 0,
    page,
  });

  const update = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === "" || v === 0 ? next.delete(k) : next.set(k, String(v))));
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };

  const products = data?.products ?? [];
  const totalPage = data?.totalPage ?? 1;
  const heading = search ? `Results for “${search}”` : category ? titleCase(category) : "BEST SELLERS";

  return (
    <div className="shop section">
      <Reveal as="h1" className="section-title">
        {heading}
      </Reveal>

      <div className="shop__bar">
        <button className="shop__filter-btn" onClick={() => setFiltersOpen(true)}>
          <PiSlidersHorizontal /> Filter and sort
        </button>
        <span className="muted">{isLoading ? "…" : `${data?.total ?? products.length} products`}</span>
      </div>

      {category && (
        <div className="chips">
          <button className="chip" onClick={() => update({ category: "" })}>
            {titleCase(category)} ✕
          </button>
        </div>
      )}

      {isError ? (
        <p className="center muted">We couldn't load products. Please try again.</p>
      ) : !isLoading && products.length === 0 ? (
        <div className="center empty-state">
          <p>No products match your filters.</p>
          <button className="btn btn--outline" onClick={() => setParams({})}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={`product-grid ${isFetching ? "is-fetching" : ""}`}>
          {isLoading
            ? Array.from({ length: 8 }, (_, i) => <ProductTileSkeleton key={i} />)
            : products.map((p, i) => (
                <Reveal key={p._id} delay={(i % 4) * 80}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
        </div>
      )}

      {totalPage > 1 && (
        <nav className="pager" aria-label="Pagination">
          <button disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
            Previous
          </button>
          <span>
            {page} / {totalPage}
          </span>
          <button disabled={page >= totalPage} onClick={() => update({ page: page + 1 })}>
            Next
          </button>
        </nav>
      )}

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} side="left" title="Filter and sort" className="filter-drawer">
        <div className="filter-drawer__body">
          <fieldset>
            <legend>Sort by</legend>
            {SORTS.map((s) => (
              <label key={s.value} className="radio">
                <input type="radio" name="sort" checked={sort === s.value} onChange={() => update({ sort: s.value })} />
                <span>{s.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Category</legend>
            <label className="radio">
              <input type="radio" name="category" checked={!category} onChange={() => update({ category: "" })} />
              <span>All</span>
            </label>
            {cats?.categories.map((c) => (
              <label key={c} className="radio">
                <input type="radio" name="category" checked={category === c} onChange={() => update({ category: c })} />
                <span>{titleCase(c)}</span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Max price: {draftPrice >= MAX_PRICE ? "Any" : formatPrice(draftPrice)}</legend>
            <input
              type="range"
              min={500}
              max={MAX_PRICE}
              step={100}
              value={draftPrice}
              onChange={(e) => setDraftPrice(Number(e.target.value))}
              onMouseUp={() => update({ price: draftPrice >= MAX_PRICE ? 0 : draftPrice })}
              onTouchEnd={() => update({ price: draftPrice >= MAX_PRICE ? 0 : draftPrice })}
              onKeyUp={() => update({ price: draftPrice >= MAX_PRICE ? 0 : draftPrice })}
            />
          </fieldset>
        </div>
        <footer className="filter-drawer__foot">
          <button className="btn btn--outline" onClick={() => setParams(search ? { q: search } : {})}>
            Clear
          </button>
          <button className="btn btn--dark" onClick={() => setFiltersOpen(false)}>
            Apply
          </button>
        </footer>
      </Drawer>
    </div>
  );
};

export default Shop;
