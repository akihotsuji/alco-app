export function BottleSilhouette({ className = "bottle-silhouette" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 120" aria-hidden>
      <path
        d="M30 8h20v10c8 6 12 16 12 28v66a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V46c0-12 4-22 12-28V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}
