import { Link } from "react-router-dom";

const Logo = ({ onClick, small }: { onClick?: () => void; small?: boolean }) => (
  <Link to="/" className={`logo ${small ? "logo--small" : ""}`} onClick={onClick} aria-label="Super Saint home">
    SUPER SAINT<span className="logo__dot">.</span>
    <sup>®</sup>
  </Link>
);

export default Logo;
