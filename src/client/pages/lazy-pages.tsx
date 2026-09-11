import { lazy } from "react";

export const AuthenticatedLayout = lazy(async () => {
  const { AuthenticatedLayout: Layout } = await import("@/client/layout/AuthenticatedLayout.tsx");
  return { default: Layout };
});

export const HomePage = lazy(async () => {
  const { HomePage: Page } = await import("@/client/pages/HomePage.tsx");
  return { default: Page };
});

export const LoginPage = lazy(async () => {
  const { LoginPage: Page } = await import("@/client/pages/LoginPage.tsx");
  return { default: Page };
});

export const SignupPage = lazy(async () => {
  const { SignupPage: Page } = await import("@/client/pages/SignupPage.tsx");
  return { default: Page };
});

export const AgePage = lazy(async () => {
  const { AgePage: Page } = await import("@/client/pages/AgePage.tsx");
  return { default: Page };
});

const ForgotPasswordPageLazy = lazy(async () => {
  const { ForgotPasswordPage: Page } = await import("@/client/pages/PasswordResetPages.tsx");
  return { default: Page };
});

export function ForgotPasswordPage() {
  return <ForgotPasswordPageLazy />;
}

export const ResetPasswordPage = lazy(async () => {
  const { ResetPasswordPage: Page } = await import("@/client/pages/PasswordResetPages.tsx");
  return { default: Page };
});

const LegalDocumentPage = lazy(async () => {
  const { LegalPage: Page } = await import("@/client/pages/LegalPage.tsx");
  return { default: Page };
});

export function LegalTermsPage() {
  return <LegalDocumentPage kind="terms" />;
}

export function LegalPrivacyPage() {
  return <LegalDocumentPage kind="privacy" />;
}

export const SummaryWeekPage = lazy(async () => {
  const { SummaryWeekPage: Page } = await import("@/client/pages/summary/SummaryPages.tsx");
  return { default: Page };
});

export const SummaryMonthPage = lazy(async () => {
  const { SummaryMonthPage: Page } = await import("@/client/pages/summary/SummaryPages.tsx");
  return { default: Page };
});

export const LogDayPage = lazy(async () => {
  const { LogDayPage: Page } = await import("@/client/pages/logs/LogDayPage.tsx");
  return { default: Page };
});

const LogFormPage = lazy(async () => {
  const { LogFormPage: Page } = await import("@/client/pages/logs/LogFormPage.tsx");
  return { default: Page };
});

export function LogNewPage() {
  return <LogFormPage mode="new" />;
}

export function LogEditPage() {
  return <LogFormPage mode="edit" />;
}

export const MyDrinkListPage = lazy(async () => {
  const { MyDrinkListPage: Page } = await import("@/client/pages/logs/MyDrinkPages.tsx");
  return { default: Page };
});

export const MyDrinkFormPage = lazy(async () => {
  const { MyDrinkFormPage: Page } = await import("@/client/pages/logs/MyDrinkPages.tsx");
  return { default: Page };
});

export const CellarPage = lazy(async () => {
  const { CellarPage: Page } = await import("@/client/pages/cellar/CellarPages.tsx");
  return { default: Page };
});

export const ArchivePage = lazy(async () => {
  const { ArchivePage: Page } = await import("@/client/pages/cellar/CellarPages.tsx");
  return { default: Page };
});

export const BottleBatchPage = lazy(async () => {
  const { BottleBatchPage: Page } = await import("@/client/pages/cellar/CellarPages.tsx");
  return { default: Page };
});

export const BottleDetailPage = lazy(async () => {
  const { BottleDetailPage: Page } = await import("@/client/pages/cellar/CellarPages.tsx");
  return { default: Page };
});

const BottleFormPage = lazy(async () => {
  const { BottleFormPage: Page } = await import("@/client/pages/cellar/CellarPages.tsx");
  return { default: Page };
});

export function BottleNewPage() {
  return <BottleFormPage mode="new" />;
}

export function BottleEditPage() {
  return <BottleFormPage mode="edit" />;
}

export const NotesPage = lazy(async () => {
  const { NotesPage: Page } = await import("@/client/pages/notes/NotePages.tsx");
  return { default: Page };
});

export const NoteDetailPage = lazy(async () => {
  const { NoteDetailPage: Page } = await import("@/client/pages/notes/NotePages.tsx");
  return { default: Page };
});

const NoteFormPage = lazy(async () => {
  const { NoteFormPage: Page } = await import("@/client/pages/notes/NotePages.tsx");
  return { default: Page };
});

export function NoteNewPage() {
  return <NoteFormPage mode="new" />;
}

export function NoteEditPage() {
  return <NoteFormPage mode="edit" />;
}

export const SettingsPage = lazy(async () => {
  const { SettingsPage: Page } = await import("@/client/pages/SettingsPage.tsx");
  return { default: Page };
});

export const AccountDeletePage = lazy(async () => {
  const { AccountDeletePage: Page } = await import("@/client/pages/AccountDeletionPages.tsx");
  return { default: Page };
});

export const AccountDeletedPage = lazy(async () => {
  const { AccountDeletedPage: Page } = await import("@/client/pages/AccountDeletionPages.tsx");
  return { default: Page };
});

export const NotFoundPage = lazy(async () => {
  const { NotFoundPage: Page } = await import("@/client/pages/NotFoundPage.tsx");
  return { default: Page };
});
