import toast from "react-hot-toast";
import { PiPackage, PiSignOut } from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useMyOrdersQuery } from "../redux/api/orderAPI";
import { userNotExist } from "../redux/reducer/userReducer";
import { RootState } from "../redux/store";
import { formatPrice, photoUrl } from "../utils/format";

export const StatusPill = ({ status }: { status: string }) => (
  <span className={`status status--${status.toLowerCase()}`}>{status}</span>
);

const Orders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.userReducer);
  const { data, isLoading, isError } = useMyOrdersQuery("");
  const orders = [...(data?.orders ?? [])].reverse();

  const logout = () => {
    dispatch(userNotExist());
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <div className="account section">
      <div className="account__head">
        <div>
          <h1 className="section-title left">My Account</h1>
          <p className="muted">
            {user?.name} · {user?.email}
          </p>
        </div>
        <button className="btn btn--outline" onClick={logout}>
          <PiSignOut /> Log out
        </button>
      </div>

      <h2 className="account__sub">Order history</h2>
      {isLoading ? (
        <div className="shimmer shimmer--block" />
      ) : isError ? (
        <p className="muted">Couldn't load your orders.</p>
      ) : orders.length === 0 ? (
        <div className="empty-state center card">
          <PiPackage />
          <p>You haven't placed any orders yet.</p>
          <Link to="/collections/all" className="btn btn--dark">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <Link to={`/order/${o._id}`} key={o._id} className="order-card card">
              <div className="order-card__imgs">
                {o.orderItems.slice(0, 3).map((i) => (
                  <img key={i._id} src={photoUrl(i.photo)} alt="" />
                ))}
              </div>
              <div className="order-card__info">
                <strong>Order #{o._id.slice(-8).toUpperCase()}</strong>
                <span className="muted small">
                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""} ·{" "}
                  {o.orderItems.reduce((n, i) => n + i.quantity, 0)} item(s) · {o.paymentMethod === "ONLINE" ? "Paid online" : "Cash on Delivery"}
                </span>
              </div>
              <div className="order-card__right">
                <StatusPill status={o.status} />
                <strong>{formatPrice(o.total)}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
