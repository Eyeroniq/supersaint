import { FormEvent, useEffect, useRef, useState } from "react";
import { PiMagnifyingGlass, PiX } from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useSearchProductsQuery } from "../../redux/api/productAPI";
import { setSearchOpen } from "../../redux/reducer/uiReducer";
import { RootState } from "../../redux/store";
import { formatPrice, photoUrl } from "../../utils/format";

const useDebounced = (value: string, ms = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const SearchOverlay = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector((state: RootState) => state.uiReducer.searchOpen);
  const [term, setTerm] = useState("");
  const query = useDebounced(term.trim());
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useSearchProductsQuery(
    { search: query, page: 1, price: 0, sort: "", category: "" },
    { skip: !open || !query }
  );

  const close = () => dispatch(setSearchOpen(false));

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    close();
    navigate(`/collections/all?q=${encodeURIComponent(term.trim())}`);
  };

  const results = query ? data?.products.slice(0, 6) ?? [] : [];

  return (
    <div className={`search-overlay ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="search-overlay__backdrop" onClick={close} />
      <div className="search-overlay__panel">
        <form onSubmit={submit} className="search-overlay__form">
          <PiMagnifyingGlass />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search"
            aria-label="Search products"
          />
          <button type="button" className="icon-btn" onClick={close} aria-label="Close search">
            <PiX />
          </button>
        </form>

        {query && (
          <div className="search-overlay__results">
            {isFetching && !results.length ? (
              <p className="muted">Searching…</p>
            ) : results.length ? (
              <>
                {results.map((p) => (
                  <Link key={p._id} to={`/products/${p._id}`} onClick={close} className="search-result">
                    <img src={photoUrl(p.photo)} alt="" />
                    <span>
                      <strong>{p.name}</strong>
                      <small>{formatPrice(p.price)}</small>
                    </span>
                  </Link>
                ))}
                <button className="link-btn" onClick={submit}>
                  View all results for “{term.trim()}”
                </button>
              </>
            ) : (
              <p className="muted">No results for “{query}”.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchOverlay;
