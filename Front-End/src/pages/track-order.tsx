import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { RootState } from "../redux/store";

const TrackOrder = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.userReducer);
  const [orderId, setOrderId] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = orderId.trim().replace(/^#/, "");
    if (!/^[a-f0-9]{24}$/i.test(id)) return toast.error("Please enter the full order ID from your confirmation");
    navigate(user ? `/order/${id}` : `/login?redirect=${encodeURIComponent(`/order/${id}`)}`);
  };

  return (
    <div className="auth section">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="section-title">Track Order</h1>
        <p className="muted center">Enter the order ID shown on your order confirmation.</p>
        <label className="field">
          <span>Order ID</span>
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="e.g. 6ae1ac2f9149de4348a55642" required />
        </label>
        <button className="btn btn--dark btn--block btn--lg">Track</button>
        {user && (
          <p className="center">
            Or see all your orders in <Link to="/account" className="underline">My Account</Link>
          </p>
        )}
      </form>
    </div>
  );
};

export default TrackOrder;
