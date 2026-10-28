import {
  BrowserRouter as Router,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";

import Loader from "./components/loader";
import { Toaster } from "react-hot-toast";
import { userExist, userNotExist } from "./redux/reducer/userReducer";
import { closeAll } from "./redux/reducer/uiReducer";
import { useDispatch, useSelector } from "react-redux";
import { getMe } from "./redux/api/userAPI";
import axios from "axios";
import { getAnonId } from "./analytics/identity";
import { setTrackingUser } from "./analytics/tracker";
import { setAssignments, Assignment } from "./redux/reducer/experimentReducer";
import { setFreeShippingThreshold } from "./redux/reducer/cartReducer";
import { UserReducerInitialState } from "./types/reducer-types";
import ProtectedRoute from "./components/protected-route";
import Header from "./components/store/header";
import Footer from "./components/store/footer";
import MenuDrawer from "./components/store/menu-drawer";
import CartDrawer from "./components/store/cart-drawer";
import SearchOverlay from "./components/store/search-overlay";

const Home = lazy(() => import("./pages/home"));
const Shop = lazy(() => import("./pages/shop"));
const ProductPage = lazy(() => import("./pages/product"));
const Cart = lazy(() => import("./pages/cart"));
const Login = lazy(() => import("./pages/login"));
const Orders = lazy(() => import("./pages/orders"));
const OrderDetails = lazy(() => import("./pages/order-details"));
const TrackOrder = lazy(() => import("./pages/track-order"));
const StaticPage = lazy(() => import("./pages/static-page"));
const NotFound = lazy(() => import("./pages/not-found"));
const Checkout = lazy(() => import("./pages/checkout"));

//Importing Admin Routes
const Dashboard = lazy(() => import("./pages/admin/dashboard"));
const Products = lazy(() => import("./pages/admin/products"));
const Customers = lazy(() => import("./pages/admin/customers"));
const Transaction = lazy(() => import("./pages/admin/transaction"));
const Barcharts = lazy(() => import("./pages/admin/charts/barcharts"));
const Piecharts = lazy(() => import("./pages/admin/charts/piecharts"));
const Linecharts = lazy(() => import("./pages/admin/charts/linecharts"));
const Coupon = lazy(() => import("./pages/admin/apps/coupon"));
const Stopwatch = lazy(() => import("./pages/admin/apps/stopwatch"));
const Toss = lazy(() => import("./pages/admin/apps/toss"));
const NewProduct = lazy(() => import("./pages/admin/management/newproduct"));
const ProductManagement = lazy(
  () => import("./pages/admin/management/productmanagement")
);
const TransactionManagement = lazy(
  () => import("./pages/admin/management/transactionmanagement")
);

// Storefront chrome (announcement bar, header, drawers, footer) around shop pages
const StoreLayout = () => {
  const { pathname } = useLocation();
  const dispatch = useDispatch();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    dispatch(closeAll());
  }, [pathname, dispatch]);

  return (
    <>
      <Header />
      <main className="store-main" key={pathname}>
        <Suspense fallback={<Loader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MenuDrawer />
      <CartDrawer />
      <SearchOverlay />
    </>
  );
};

// Redirects to login and comes back here afterwards
const RequireLogin = ({ loggedIn }: { loggedIn: boolean }) => {
  const { pathname, search } = useLocation();
  return loggedIn ? (
    <Outlet />
  ) : (
    <Navigate to={`/login?redirect=${encodeURIComponent(pathname + search)}`} replace />
  );
};

// Login/register pages; once signed in, continue to wherever the user was headed
const GuestOnly = ({ loggedIn }: { loggedIn: boolean }) => {
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const target = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
  return loggedIn ? <Navigate to={target} replace /> : <Outlet />;
};

function App() {
  const { user, token, loading } = useSelector(
    (state: { userReducer: UserReducerInitialState }) => state.userReducer
  );

  const dispatch = useDispatch();

  useEffect(() => setTrackingUser(user?._id ?? null), [user?._id]);

  // Experiment variants are decided by the server from the anonymous visitor id
  useEffect(() => {
    axios
      .get<{
        assignments: Assignment[];
        freeShippingThreshold: number;
        couponOffer: { code: string; label: string } | null;
      }>(`${import.meta.env.VITE_SERVER}/api/v1/experiments/assignments`, {
        params: { anonId: getAnonId() },
      })
      .then(({ data }) => {
        dispatch(setAssignments({ assignments: data.assignments, couponOffer: data.couponOffer }));
        dispatch(setFreeShippingThreshold(data.freeShippingThreshold));
      })
      .catch(() => dispatch(setFreeShippingThreshold(999)));
  }, [dispatch]);

  useEffect(() => {
    if (!token) {
      dispatch(userNotExist());
      return;
    }
    getMe()
      .then((data) => dispatch(userExist(data.user)))
      .catch(() => dispatch(userNotExist()));
    // Only on first load; login/logout update the store directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return loading ? (
    <Loader />
  ) : (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/collections/all" element={<Shop />} />
            <Route path="/products/:id" element={<ProductPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/track-order" element={<TrackOrder />} />
            <Route path="/pages/:slug" element={<StaticPage />} />
            <Route path="/search" element={<Navigate to="/collections/all" replace />} />
            {/* Not Logged In Route */}
            <Route element={<GuestOnly loggedIn={!!user} />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Login mode="register" />} />
            </Route>
            {/* Logged In User Routes */}
            <Route element={<RequireLogin loggedIn={!!user} />}>
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/account" element={<Orders />} />
              <Route path="/order/:id" element={<OrderDetails />} />
            </Route>
            <Route path="/orders" element={<Navigate to="/account" replace />} />
            <Route path="/shipping" element={<Navigate to="/checkout" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* //Admin Routes  */}
          <Route
            element={
              <ProtectedRoute
                isAuthenticated={true}
                adminOnly={true}
                admin={user?.role === "admin" ? true : false}
              />
            }
          >
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/product" element={<Products />} />
            <Route path="/admin/customer" element={<Customers />} />
            <Route path="/admin/transaction" element={<Transaction />} />
            {/* Charts */}
            <Route path="/admin/chart/bar" element={<Barcharts />} />
            <Route path="/admin/chart/pie" element={<Piecharts />} />
            <Route path="/admin/chart/line" element={<Linecharts />} />
            {/* Apps */}
            <Route path="/admin/app/coupon" element={<Coupon />} />
            <Route path="/admin/app/stopwatch" element={<Stopwatch />} />
            <Route path="/admin/app/toss" element={<Toss />} />

            {/* Management */}
            <Route path="/admin/product/new" element={<NewProduct />} />

            <Route path="/admin/product/:id" element={<ProductManagement />} />

            <Route
              path="/admin/transaction/:id"
              element={<TransactionManagement />}
            />
          </Route>
        </Routes>
      </Suspense>
      <Toaster
        position="bottom-center"
        toastOptions={{ style: { borderRadius: 0, background: "#111", color: "#fff", fontSize: "0.9rem" } }}
      />
    </Router>
  );
}

export default App;
