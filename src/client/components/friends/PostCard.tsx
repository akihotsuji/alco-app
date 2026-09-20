import { useState } from "react";
import { Link } from "react-router";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { ReactionBar } from "@/client/components/friends/ReactionBar.tsx";
import { SocialAvatar } from "@/client/components/friends/SocialAvatar.tsx";
import { socialPhotoContentUrl } from "@/client/hooks/use-social.ts";
import { formatRelativeShareTime } from "@/client/lib/social-time.ts";
import { type SocialPost, socialKindLabel, socialMoreBottlesLabel } from "@/shared/social.ts";
import { formatRatingX10 } from "@/shared/tasting-notes.ts";

type PostCardProps = {
  post: SocialPost;
  compact?: boolean;
  eagerPhoto?: boolean;
};

export function firstDisplayablePhotoId(post: SocialPost): string | undefined {
  for (const item of post.items) {
    const photoId = item.photoIds[0];
    if (photoId) {
      return photoId;
    }
  }
  return undefined;
}

export function PostCard({ post, compact = false, eagerPhoto = false }: PostCardProps) {
  if (compact) {
    return <FeedPostCard post={post} eagerPhoto={eagerPhoto} />;
  }
  return <DetailStylePostCard post={post} />;
}

function FeedPostCard({ post, eagerPhoto }: { post: SocialPost; eagerPhoto: boolean }) {
  const first = post.items[0];
  const photoId = firstDisplayablePhotoId(post);
  const extraItems = Math.max(0, post.items.length - 1);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoId) && !photoFailed;
  return (
    <article className="social-feed-card" data-testid="social-feed-card">
      <Link className="social-feed-card-main" to={`/friends/posts/${post.id}`}>
        <div className="social-feed-thumb">
          {showPhoto && photoId ? (
            <img
              className="social-feed-thumb-img"
              src={socialPhotoContentUrl(post.id, photoId, "thumb")}
              alt=""
              width={72}
              height={88}
              loading={eagerPhoto ? "eager" : "lazy"}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <BottleSilhouette className="social-feed-thumb-silhouette" />
          )}
          {extraItems > 0 ? (
            <span className="social-feed-thumb-more">{socialMoreBottlesLabel(extraItems)}</span>
          ) : null}
        </div>
        <div className="social-feed-body">
          <header className="social-feed-head">
            <SocialAvatar profile={post.author} size={24} />
            <p className="social-feed-name">{post.author.nickname}</p>
            <p className="social-feed-time">{formatRelativeShareTime(post.publishedAt)}</p>
          </header>
          <p className="social-feed-kind">{socialKindLabel(post.kind, post.items.length)}</p>
          <h3 className="social-feed-title">{first?.name ?? "お酒"}</h3>
          {first?.ratingX10 != null || first?.comment ? (
            <p className="social-feed-meta">
              {first.ratingX10 != null ? formatRatingX10(first.ratingX10) : null}
              {first.ratingX10 != null && first.comment ? " · " : null}
              {first.comment ? first.comment : null}
            </p>
          ) : null}
        </div>
      </Link>
      <ReactionBar
        variant="compact"
        postId={post.id}
        reactions={post.reactions}
        canReact={post.canReact}
      />
    </article>
  );
}

function DetailStylePostCard({ post }: { post: SocialPost }) {
  const first = post.items[0];
  const photoId = firstDisplayablePhotoId(post);
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
        {first?.ratingX10 != null ? (
          <p className="social-card-rating">{formatRatingX10(first.ratingX10)}</p>
        ) : null}
        {first?.comment ? <p className="social-card-comment">{first.comment}</p> : null}
      </Link>
      <ReactionBar postId={post.id} reactions={post.reactions} canReact={post.canReact} />
    </article>
  );
}
