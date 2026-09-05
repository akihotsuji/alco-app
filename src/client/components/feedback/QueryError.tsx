import { Button } from "@/client/components/ui/button.tsx";

type QueryErrorProps = {
  onRetry: () => void;
  retrying?: boolean;
};

export function QueryError({ onRetry, retrying = false }: QueryErrorProps) {
  return (
    <div className="query-error" role="alert">
      <p className="query-error-message">読み込めませんでした</p>
      <Button type="button" variant="secondary" onClick={onRetry} disabled={retrying}>
        再試行
      </Button>
    </div>
  );
}
