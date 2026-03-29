import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ExpensesPage from "./pages/ExpensesPage.jsx";
import YourExpensesPage from "./pages/YourExpensesPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PostLoginRedirect from "./components/PostLoginRedirect.jsx";
import OAuthCallbackPage from "./pages/OAuthCallbackPage.jsx";
import RecoverPasswordPage from "./pages/RecoverPasswordPage.jsx";

function Private({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/recover" element={<RecoverPasswordPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<PostLoginRedirect />} />
        <Route path="expenses/list" element={<YourExpensesPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
