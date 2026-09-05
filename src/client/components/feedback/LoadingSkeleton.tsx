const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

type ListSkeletonProps = {
  count?: number;
};

export function ListSkeleton({ count = 4 }: ListSkeletonProps) {
  const keys = SKELETON_KEYS.slice(0, count);
  return (
    <div className="skeleton-list" role="status">
      <span className="visually-hidden">読み込み中</span>
      {keys.map((key) => (
        <div key={key} className="skeleton-row" />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="skeleton-detail" role="status">
      <span className="visually-hidden">読み込み中</span>
      <div className="skeleton-photo" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line-short" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="skeleton-card" role="status">
      <span className="visually-hidden">読み込み中</span>
    </div>
  );
}
