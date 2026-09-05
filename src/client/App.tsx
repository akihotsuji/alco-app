import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { GuestOnly } from "./auth/GuestOnly.tsx";
import { RequireAuth } from "./auth/RequireAuth.tsx";
import { authClient } from "./lib/auth-client.ts";
import { QueryProvider } from "./lib/query-provider.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";

export function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<HomePage />} />
          </Route>
          <Route path="*" element={<UnknownRoute />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}

function UnknownRoute() {
  const { data, isPending } = authClient.useSession();
  if (isPending) {
    return <div className="auth-boot" />;
  }
  if (!data) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/" replace />;
}
