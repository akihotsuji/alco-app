import { Bell, Users } from "lucide-react";
import { Link } from "react-router";
import { useUnreadCount } from "@/client/hooks/use-social.ts";

export function FriendsHeaderActions() {
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  return (
    <div className="friends-header-actions">
      <Link className="header-icon-link" to="/friends/notifications" aria-label="通知">
        <Bell size={20} />
        {count > 0 ? <span className="friends-unread-badge">{count > 99 ? "99+" : count}</span> : null}
      </Link>
      <Link className="header-icon-link" to="/friends/list" aria-label="友達一覧">
        <Users size={20} />
      </Link>
    </div>
  );
}
