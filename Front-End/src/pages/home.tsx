import { Link } from "react-router-dom";
import Accordion from "../components/store/accordion";
import ProductCard, { ProductTileSkeleton } from "../components/store/product-card";
import Reveal from "../components/store/reveal";
import { FAQS, SITE } from "../config/site";
import { useLatestProductsQuery } from "../redux/api/productAPI";

const VALUES = [
  { title: "SuperFlex™ Fabric", body: "92% cotton, 8% spandex. Soft, stretchy, built to move." },
  { title: "Fitted, Not Tight", body: "Sculpted through chest and arms, relaxed at the waist." },
  { title: "Pre-Shrunk", body: "The fit you buy is the fit you keep, wash after wash." },
];

function Home() {
  const { data, isLoading, isError } = useLatestProductsQuery("");
  const products = data?.products ?? [];

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__bg" aria-hidden />
        <div className="hero__content">
          <h1 className="hero__title">
            {SITE.heroTitle.split(" ").map((word, i) => (
              <span key={i} style={{ animationDelay: `${150 + i * 120}ms` }}>
                {word}
              </span>
            ))}
          </h1>
          <p className="hero__sub">{SITE.heroSubtitle}</p>
          <Link to="/collections/all" className="btn btn--light">
            Shop now
          </Link>
        </div>
      </section>

      <section className="section">
        <Reveal as="h2" className="section-title">
          BEST SELLERS
        </Reveal>
        {isError ? (
          <p className="center muted">We couldn't load products right now. Please refresh.</p>
        ) : (
          <div className="product-grid">
            {isLoading
              ? Array.from({ length: 8 }, (_, i) => <ProductTileSkeleton key={i} />)
              : products.slice(0, 8).map((p, i) => (
                  <Reveal key={p._id} delay={(i % 4) * 90}>
                    <ProductCard product={p} />
                  </Reveal>
                ))}
          </div>
        )}
        <Reveal className="center">
          <Link to="/collections/all" className="btn btn--dark">
            View all
          </Link>
        </Reveal>
      </section>

      <section className="values">
        {VALUES.map((v, i) => (
          <Reveal key={v.title} delay={i * 100} className="values__item">
            <h3>{v.title}</h3>
            <p>{v.body}</p>
          </Reveal>
        ))}
      </section>

      <section className="faq">
        <Reveal as="h2" className="section-title">
          FREQUENTLY ASKED QUESTIONS
        </Reveal>
        <div className="faq__list">
          {FAQS.map((f) => (
            <Accordion key={f.q} title={f.q} icon="plus">
              <p>{f.a}</p>
            </Accordion>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;
