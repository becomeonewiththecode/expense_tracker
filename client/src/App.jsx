import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ExpensesHubPage from "./pages/ExpensesHubPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import BudgetHubPage from "./pages/BudgetHubPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PostLoginRedirect from "./components/PostLoginRedirect.jsx";
import OAuthCallbackPage from "./pages/OAuthCallbackPage.jsx";
import RecoverPasswordPage from "./pages/RecoverPasswordPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdvisorShareViewPage from "./pages/AdvisorShareViewPage.jsx";

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
      <Route path="/share/:token" element={<AdvisorShareViewPage />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<PostLoginRedirect />} />
        <Route path="expenses/list" element={<ExpensesHubPage />} />
        <Route path="expenses" element={<Navigate to="/budget?view=import" replace />} />
        <Route path="renewals" element={<Navigate to="/expenses/list?view=renewals" replace />} />
        <Route path="prescriptions" element={<Navigate to="/expenses/list?view=prescriptions" replace />} />
        <Route path="payment-plans" element={<Navigate to="/expenses/list?view=payment-plans" replace />} />
        <Route path="budget" element={<BudgetHubPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="income" element={<Navigate to="/budget?view=income" replace />} />
        <Route path="savings" element={<Navigate to="/budget?view=savings" replace />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
