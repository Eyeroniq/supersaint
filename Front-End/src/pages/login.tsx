import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { useLoginMutation, useRegisterMutation } from "../redux/api/userAPI";
import { loggedIn } from "../redux/reducer/userReducer";
import { MessageResponse } from "../types/api-types";

const Login = ({ mode = "login" }: { mode?: "login" | "register" }) => {
  const isRegister = mode === "register";
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [register, { isLoading: registering }] = useRegisterMutation();
  const busy = loggingIn || registering;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = isRegister
      ? await register({ name: name.trim(), email: email.trim(), password })
      : await login({ email: email.trim(), password });

    if ("data" in res && res.data) {
      dispatch(loggedIn({ user: res.data.user, token: res.data.token }));
      toast.success(res.data.message);
      // GuestOnly route sends the now-logged-in user on to ?redirect
    } else {
      const error = (res as { error: FetchBaseQueryError }).error;
      const message = (error?.data as MessageResponse | undefined)?.message;
      toast.error(message || "Could not reach the server. Please try again.");
    }
  };

  const other = isRegister ? "/login" : "/register";
  const keepRedirect = redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : "";

  return (
    <div className="auth section">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="section-title">{isRegister ? "Create account" : "Login"}</h1>
        <p className="muted center">
          {isRegister ? "Join Super Saint to track orders and check out faster." : "Enter your email and password to log in."}
        </p>

        {isRegister && (
          <label className="field">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <div className="field__with-btn">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            <button type="button" className="link-btn" onClick={() => setShowPassword((s) => !s)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {isRegister && <small className="muted">At least 6 characters</small>}
        </label>

        <button className="btn btn--dark btn--block btn--lg" disabled={busy}>
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>

        <p className="center">
          {isRegister ? "Already have an account? " : "New here? "}
          <Link to={other + keepRedirect} className="underline">
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
