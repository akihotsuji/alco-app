type QueryErrorProps = {
  onRetry: () => void;
  retrying?: boolean;
};

export function QueryError({ onRetry, retrying = false }: QueryErrorProps) {
  return (
    <div className="query-error" role="alert">
      <p className="query-error-message">読み込めませんでした</p>
      <button type="button" className="btn-secondary" onClick={onRetry} disabled={retrying}>
        再試行
      </button>
    </div>
  );
}
