import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="section center empty-state not-found">
    <h1 className="not-found__code">404</h1>
    <p>This page took a rest day.</p>
    <Link to="/" className="btn btn--dark">
      Back to home
    </Link>
  </div>
);

export default NotFound;
