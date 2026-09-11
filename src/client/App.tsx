import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router";
import { GuestOnly } from "./auth/GuestOnly.tsx";
import { RequireAgeVerified } from "./auth/RequireAgeVerified.tsx";
import { RequireAuth } from "./auth/RequireAuth.tsx";
import {
  discardAccountScopedClientData,
  subscribeAccountDeletionAccepted,
} from "./lib/account-deletion-client.ts";
import { authClient } from "./lib/auth-client.ts";
import { QueryProvider } from "./lib/query-provider.tsx";
import {
  AccountDeletedPage,
  AccountDeletePage,
  AgePage,
  ArchivePage,
  AuthenticatedLayout,
  BottleBatchPage,
  BottleDetailPage,
  BottleEditPage,
  BottleNewPage,
  CellarPage,
  ForgotPasswordPage,
  HomePage,
  LegalPrivacyPage,
  LegalTermsPage,
  LogDayPage,
  LogEditPage,
  LoginPage,
  LogNewPage,
  MyDrinkFormPage,
  MyDrinkListPage,
  NoteDetailPage,
  NoteEditPage,
  NoteNewPage,
  NotesPage,
  NotFoundPage,
  ResetPasswordPage,
  SettingsPage,
  SignupPage,
  SummaryMonthPage,
  SummaryWeekPage,
} from "./pages/lazy-pages.tsx";

function AccountDeletionEffects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeAccountDeletionAccepted(() => {
      void queryClient.cancelQueries();
      queryClient.clear();
      discardAccountScopedClientData();
      navigate("/account-deleted", { replace: true });
      authClient.$store.notify("$sessionSignal");
    });
  }, [navigate, queryClient]);
  return null;
}

export function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AccountDeletionEffects />
        <Routes>
          <Route
            path="/terms"
            element={
              <Suspense fallback={<main className="legal-page" />}>
                <LegalTermsPage />
              </Suspense>
            }
          />
          <Route
            path="/privacy"
            element={
              <Suspense fallback={<main className="legal-page" />}>
                <LegalPrivacyPage />
              </Suspense>
            }
          />
          <Route
            path="/account-deleted"
            element={
              <Suspense fallback={<main className="account-deleted-page" />}>
                <AccountDeletedPage />
              </Suspense>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={<main className="auth-page" />}>
                <ForgotPasswordPage />
              </Suspense>
            }
          />
          <Route
            path="/reset-password"
            element={
              <Suspense fallback={<main className="auth-page" />}>
                <ResetPasswordPage />
              </Suspense>
            }
          />
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/age" element={<AgePage />} />
            <Route element={<AuthenticatedLayout />}>
              <Route path="/settings/account/delete" element={<AccountDeletePage />} />
              <Route element={<RequireAgeVerified />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/summary/week" element={<SummaryWeekPage />} />
                <Route path="/summary/month" element={<SummaryMonthPage />} />
                <Route path="/logs" element={<LogDayPage />} />
                <Route path="/logs/new" element={<LogNewPage />} />
                <Route path="/logs/my-drinks" element={<MyDrinkListPage />} />
                <Route path="/logs/my-drinks/new" element={<MyDrinkFormPage />} />
                <Route path="/logs/my-drinks/:myDrinkId/edit" element={<MyDrinkFormPage />} />
                <Route path="/logs/entries/:logId/edit" element={<LogEditPage />} />
                <Route path="/logs/:date" element={<LogDayPage />} />
                <Route path="/cellar" element={<CellarPage />} />
                <Route path="/cellar/archive" element={<ArchivePage />} />
                <Route path="/cellar/new" element={<BottleNewPage />} />
                <Route path="/cellar/batch" element={<BottleBatchPage />} />
                <Route path="/cellar/:bottleId/edit" element={<BottleEditPage />} />
                <Route path="/cellar/:bottleId" element={<BottleDetailPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/notes/new" element={<NoteNewPage />} />
                <Route path="/notes/:noteId/edit" element={<NoteEditPage />} />
                <Route path="/notes/:noteId" element={<NoteDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
