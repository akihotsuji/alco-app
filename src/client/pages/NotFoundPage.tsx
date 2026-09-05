import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";

export function NotFoundPage() {
  return (
    <EmptyState
      pose="surprised"
      message="ページが見つかりませんでした"
      actionLabel="ホームへ"
      actionTo="/"
    />
  );
}
