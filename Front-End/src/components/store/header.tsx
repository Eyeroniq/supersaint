import { useEffect, useState } from "react";
import { PiHandbag, PiList, PiMagnifyingGlass, PiUser } from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { setCartOpen, setMenuOpen, setSearchOpen } from "../../redux/reducer/uiReducer";
import { RootState } from "../../redux/store";
import AnnouncementBar from "./announcement-bar";
import Logo from "./logo";

const Header = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.userReducer);
  const count = useSelector((state: RootState) =>
    state.cartReducer.cartItems.reduce((n, i) => n + i.quantity, 0)
  );
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Little pop on the bag whenever the count changes
  useEffect(() => {
    if (!count) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <>
      <AnnouncementBar />
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="site-header__inner">
          <div className="site-header__left">
            <button className="icon-btn" aria-label="Open menu" onClick={() => dispatch(setMenuOpen(true))}>
              <PiList />
            </button>
          </div>

          <Logo />

          <div className="site-header__right">
            <button className="icon-btn" aria-label="Search" onClick={() => dispatch(setSearchOpen(true))}>
              <PiMagnifyingGlass />
            </button>
            <Link
              to={user ? "/account" : "/login"}
              className="icon-btn hide-mobile"
              aria-label={user ? "Account" : "Log in"}
            >
              <PiUser />
            </Link>
            <button
              className={`icon-btn cart-btn ${bump ? "bump" : ""}`}
              aria-label={`Cart, ${count} items`}
              onClick={() => dispatch(setCartOpen(true))}
            >
              <PiHandbag />
              {count > 0 && <span className="cart-count">{count}</span>}
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
