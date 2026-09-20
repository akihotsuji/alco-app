import { Link } from "react-router";
import { SocialAvatar } from "@/client/components/friends/SocialAvatar.tsx";
import { ReactionBar } from "@/client/components/friends/ReactionBar.tsx";
import { socialPhotoContentUrl } from "@/client/hooks/use-social.ts";
import { formatRelativeShareTime } from "@/client/lib/social-time.ts";
import { socialKindLabel, type SocialPost } from "@/shared/social.ts";
import { formatRatingX10 } from "@/shared/tasting-notes.ts";

type PostCardProps = {
  post: SocialPost;
  compact?: boolean;
};

export function PostCard({ post, compact = false }: PostCardProps) {
  const first = post.items[0];
  const photoId = first?.photoIds[0];
  return (
    <article className="social-card">
      <Link className="social-card-main" to={`/friends/posts/${post.id}`}>
        <header className="social-card-head">
          <SocialAvatar profile={post.author} size={36} />
          <div>
            <p className="social-card-name">{post.author.nickname}</p>
            <p className="social-card-meta">
              {formatRelativeShareTime(post.publishedAt)}
              {" · "}
              {socialKindLabel(post.kind, post.items.length)}
              {post.edited ? " · 編集済み" : ""}
            </p>
          </div>
        </header>
        {photoId ? (
          <img
            className="social-card-photo"
            src={socialPhotoContentUrl(post.id, photoId, "thumb")}
            alt=""
          />
        ) : null}
        <h3 className="social-card-title">{first?.name ?? "お酒"}</h3>
        {first?.ratingX10 != null ? <p className="social-card-rating">{formatRatingX10(first.ratingX10)}</p> : null}
        {first?.comment && compact ? <p className="social-card-comment">{truncate(first.comment, 80)}</p> : null}
        {first?.comment && !compact ? <p className="social-card-comment">{first.comment}</p> : null}
      </Link>
      <ReactionBar postId={post.id} reactions={post.reactions} canReact={post.canReact} />
    </article>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
