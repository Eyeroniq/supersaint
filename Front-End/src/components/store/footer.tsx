import { PiInstagramLogo } from "react-icons/pi";
import { Link } from "react-router-dom";
import { POLICY_LINKS, SITE, SUPPORT_LINKS } from "../../config/site";
import Logo from "./logo";

const Footer = () => (
  <footer className="site-footer">
    <div className="site-footer__grid">
      <div className="site-footer__col">
        <h3>Support</h3>
        {SUPPORT_LINKS.map((l) => (
          <Link key={l.label} to={l.to}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="site-footer__col">
        <h3>Policies</h3>
        {POLICY_LINKS.map((l) => (
          <Link key={l.label} to={l.to}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="site-footer__col site-footer__brand">
        <Logo small />
        <p>{SITE.tagline}</p>
        <p>
          Whatsapp - <a href={`https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`}>{SITE.whatsapp}</a>
        </p>
        <p>
          Email - <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </p>
      </div>
    </div>
    <a href={SITE.instagram} target="_blank" rel="noreferrer" className="site-footer__social" aria-label="Instagram">
      <PiInstagramLogo />
    </a>
    <p className="site-footer__copy">
      © {new Date().getFullYear()}, SuperSaint® All Rights Reserved
    </p>
  </footer>
);

export default Footer;
