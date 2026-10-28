import { PiInstagramLogo, PiSignOut, PiUser } from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { MENU_LINKS, SITE } from "../../config/site";
import { userNotExist } from "../../redux/reducer/userReducer";
import { setMenuOpen } from "../../redux/reducer/uiReducer";
import { RootState } from "../../redux/store";
import Drawer from "./drawer";

const MenuDrawer = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector((state: RootState) => state.uiReducer.menuOpen);
  const { user } = useSelector((state: RootState) => state.userReducer);
  const close = () => dispatch(setMenuOpen(false));

  const logout = () => {
    dispatch(userNotExist());
    close();
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <Drawer open={open} onClose={close} side="left" title="Menu" className="menu-drawer">
      <nav className="menu-drawer__nav">
        {MENU_LINKS.map((link, i) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            onClick={close}
            style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }}
          >
            {link.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink to="/admin/dashboard" onClick={close}>
            Admin Dashboard
          </NavLink>
        )}
      </nav>

      <div className="menu-drawer__foot">
        {user ? (
          <>
            <NavLink to="/account" onClick={close} className="menu-drawer__account">
              <PiUser /> {user.name.split(" ")[0]}'s account
            </NavLink>
            <button onClick={logout} className="menu-drawer__account">
              <PiSignOut /> Log out
            </button>
          </>
        ) : (
          <NavLink to="/login" onClick={close} className="menu-drawer__account">
            <PiUser /> Log in
          </NavLink>
        )}
        <a href={SITE.instagram} target="_blank" rel="noreferrer" className="menu-drawer__social" aria-label="Instagram">
          <PiInstagramLogo />
        </a>
      </div>
    </Drawer>
  );
};

export default MenuDrawer;
