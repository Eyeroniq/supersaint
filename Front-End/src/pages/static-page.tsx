import { Navigate, useParams } from "react-router-dom";
import Reveal from "../components/store/reveal";
import { PAGES } from "../config/site";

const StaticPage = () => {
  const { slug = "" } = useParams();
  const page = PAGES[slug];
  if (!page) return <Navigate to="/404" replace />;

  return (
    <article className="static-page section">
      <Reveal as="h1" className="section-title">
        {page.title}
      </Reveal>
      {page.body.map((p, i) => (
        <Reveal as="p" key={i} delay={i * 80}>
          {p}
        </Reveal>
      ))}
    </article>
  );
};

export default StaticPage;
