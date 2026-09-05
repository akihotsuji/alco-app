import { BrowserRouter, Route, Routes } from "react-router";
import { GuestOnly } from "./auth/GuestOnly.tsx";
import { RequireAuth } from "./auth/RequireAuth.tsx";
import { ToastProvider } from "./components/feedback/ToastProvider.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { PhotoEditProvider } from "./components/layout/photo-edit-context.tsx";
import { QueryProvider } from "./lib/query-provider.tsx";
import {
  ArchivePage,
  BottleDetailPage,
  BottleFormPage,
  CellarPage,
} from "./pages/cellar/CellarPages.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { LogDayPage } from "./pages/logs/LogDayPage.tsx";
import { LogFormPage } from "./pages/logs/LogFormPage.tsx";
import { MyDrinkFormPage, MyDrinkListPage } from "./pages/logs/MyDrinkPages.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { NoteDetailPage, NoteFormPage, NotesPage } from "./pages/notes/NotePages.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";
import { SummaryMonthPage, SummaryWeekPage } from "./pages/summary/SummaryPages.tsx";

export function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <PhotoEditProvider>
          <ToastProvider>
            <Routes>
              <Route element={<GuestOnly />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/summary/week" element={<SummaryWeekPage />} />
                  <Route path="/summary/month" element={<SummaryMonthPage />} />
                  <Route path="/logs" element={<LogDayPage />} />
                  <Route path="/logs/new" element={<LogFormPage mode="new" />} />
                  <Route path="/logs/my-drinks" element={<MyDrinkListPage />} />
                  <Route path="/logs/my-drinks/new" element={<MyDrinkFormPage />} />
                  <Route path="/logs/my-drinks/:myDrinkId/edit" element={<MyDrinkFormPage />} />
                  <Route path="/logs/entries/:logId/edit" element={<LogFormPage mode="edit" />} />
                  <Route path="/logs/:date" element={<LogDayPage />} />
                  <Route path="/cellar" element={<CellarPage />} />
                  <Route path="/cellar/archive" element={<ArchivePage />} />
                  <Route path="/cellar/new" element={<BottleFormPage mode="new" />} />
                  <Route path="/cellar/:bottleId/edit" element={<BottleFormPage mode="edit" />} />
                  <Route path="/cellar/:bottleId" element={<BottleDetailPage />} />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/notes/new" element={<NoteFormPage mode="new" />} />
                  <Route path="/notes/:noteId/edit" element={<NoteFormPage mode="edit" />} />
                  <Route path="/notes/:noteId" element={<NoteDetailPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </PhotoEditProvider>
      </BrowserRouter>
    </QueryProvider>
  );
}
