import { ToastProvider } from "@/client/components/feedback/ToastProvider.tsx";
import { AppShell } from "@/client/components/layout/AppShell.tsx";
import { PhotoEditProvider } from "@/client/components/layout/photo-edit-context.tsx";
import { TypeGridProvider } from "@/client/components/layout/type-grid-context.tsx";

/** 認証後だけ読む。ログイン画面の初期 JS から棚・写真編集・初回ガイドを外す */
export function AuthenticatedLayout() {
  return (
    <PhotoEditProvider>
      <ToastProvider>
        <TypeGridProvider>
          <AppShell />
        </TypeGridProvider>
      </ToastProvider>
    </PhotoEditProvider>
  );
}
