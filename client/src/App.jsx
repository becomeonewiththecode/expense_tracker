import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ExpensesPage from "./pages/ExpensesPage.jsx";
import YourExpensesPage from "./pages/YourExpensesPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import IncomePage from "./pages/IncomePage.jsx";
import RenewalsPage from "./pages/RenewalsPage.jsx";
import PrescriptionsPage from "./pages/PrescriptionsPage.jsx";
import PaymentPlansPage from "./pages/PaymentPlansPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PostLoginRedirect from "./components/PostLoginRedirect.jsx";
import OAuthCallbackPage from "./pages/OAuthCallbackPage.jsx";
import RecoverPasswordPage from "./pages/RecoverPasswordPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";

/** Logged-out users see the landing page at `/`; other app paths redirect to login. */
function AppShell() {
  const { isAuthed } = useAuth();
  const location = useLocation();

  if (!isAuthed) {
    if (location.pathname === "/") {
      return <LandingPage />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/recover" element={<RecoverPasswordPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<PostLoginRedirect />} />
        <Route path="expenses/list" element={<YourExpensesPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="renewals" element={<RenewalsPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="payment-plans" element={<PaymentPlansPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="income" element={<IncomePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
