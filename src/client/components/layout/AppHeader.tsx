import { Archive, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import {
  type HeaderLeft,
  type HeaderRight,
  logDayHref,
  type ShellHeader,
} from "@/client/lib/app-routes.ts";

type AppHeaderProps = {
  header: ShellHeader;
};

function goBack(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  const state = window.history.state as { idx?: number } | null;
  if (typeof state?.idx === "number" && state.idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}

export function AppHeader({ header }: AppHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="app-header-slot">
        <HeaderLeftSlot left={header.left} navigate={navigate} />
      </div>
      <h1 className="app-header-title">
        {header.title}
        {header.titleMuted ? <span className="app-header-muted">{header.titleMuted}</span> : null}
      </h1>
      <div className="app-header-slot app-header-slot-end">
        <HeaderRightSlot right={header.right} navigate={navigate} />
      </div>
    </header>
  );
}

function HeaderLeftSlot({
  left,
  navigate,
}: {
  left: HeaderLeft;
  navigate: ReturnType<typeof useNavigate>;
}) {
  switch (left.kind) {
    case "back":
      return (
        <IconButton label="戻る" onClick={() => goBack(navigate, left.fallback)}>
          <ChevronLeft size={22} />
        </IconButton>
      );
    case "archive":
      return (
        <IconButton label="貯蔵庫" onClick={() => navigate("/cellar/archive")}>
          <Archive size={20} />
        </IconButton>
      );
    case "day-prev":
      return (
        <IconButton label="前日" onClick={() => navigate(logDayHref(left.date))}>
          <ChevronLeft size={22} />
        </IconButton>
      );
    default:
      return <span className="app-header-spacer" />;
  }
}

function HeaderRightSlot({
  right,
  navigate,
}: {
  right: HeaderRight;
  navigate: ReturnType<typeof useNavigate>;
}) {
  switch (right.kind) {
    case "plus":
      return (
        <IconButton label="追加" onClick={() => navigate(right.to)}>
          <Plus size={20} />
        </IconButton>
      );
    case "edit":
      return (
        <Link className="header-text-link" to={right.to}>
          編集
        </Link>
      );
    case "text":
      return (
        <Link className="header-text-link" to={right.to}>
          {right.label}
        </Link>
      );
    case "day-next":
      return (
        <IconButton
          label="翌日"
          disabled={right.disabled}
          onClick={() => navigate(logDayHref(right.date))}
        >
          <ChevronRight size={22} />
        </IconButton>
      );
    default:
      return <span className="app-header-spacer" />;
  }
}
