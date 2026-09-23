import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { CardSkeleton, ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { PostCard } from "@/client/components/friends/PostCard.tsx";
import { PostDetailItem } from "@/client/components/friends/PostDetailItem.tsx";
import { ReactionBar } from "@/client/components/friends/ReactionBar.tsx";
import { SocialAvatar } from "@/client/components/friends/SocialAvatar.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import {
  useAcceptFriendRequest,
  useBlocks,
  useCancelFriendRequest,
  useCreateInvitation,
  useDeclineFriendRequest,
  useDeleteSocialAvatar,
  useFriendInvitation,
  useFriends,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useReissueInvitation,
  useSocialFeed,
  useSocialMe,
  useSocialNotifications,
  useSocialPost,
  useSocialProfile,
  useSocialProfilePosts,
  useUnblockUser,
  useUnfriend,
  useUnsharePost,
  useUpdateSocialProfile,
  useUploadSocialAvatar,
} from "@/client/hooks/use-social.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import {
  copyText,
  readOwnInviteToken,
  rememberOwnInviteToken,
} from "@/client/lib/social-invite.ts";
import { formatRelativeShareTime } from "@/client/lib/social-time.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import {
  DEFAULT_MASCOT_COLOR,
  MASCOT_COLOR_PRESETS,
  SOCIAL_COPY,
  socialBecameFriendsMessage,
  socialKindLabel,
} from "@/shared/social.ts";

export { FriendsJoinPage } from "./FriendsJoinPage.tsx";

export function FriendsFeedPage() {
  const feed = useSocialFeed();
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const friendCount = feed.data?.pages[0]?.friendCount ?? 0;
  if (feed.isPending) {
    return <CardSkeleton />;
  }
  if (feed.isError) {
    return <QueryError onRetry={() => feed.refetch()} retrying={feed.isFetching} />;
  }
  if (items.length === 0) {
    return (
      <div className="friends-feed">
        <EmptyState
          pose="default"
          message={
            friendCount === 0 ? SOCIAL_COPY.feedEmptyNoFriends : SOCIAL_COPY.feedEmptyNoPosts
          }
        />
        <Link className={buttonVariants()} to="/friends/invite">
          友達を招待
        </Link>
        <Link className={buttonVariants({ variant: "secondary" })} to="/friends/join">
          {SOCIAL_COPY.pasteInvite}
        </Link>
      </div>
    );
  }
  return (
    <div className="friends-feed">
      {items.map((post, index) => (
        <PostCard key={post.id} post={post} compact eagerPhoto={index < 3} />
      ))}
      {feed.hasNextPage ? (
        <Button type="button" variant="ghost" onClick={() => void feed.fetchNextPage()}>
          さらに表示
        </Button>
      ) : null}
    </div>
  );
}

export function FriendsListPage() {
  const list = useFriends();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const cancel = useCancelFriendRequest();
  const unfriend = useUnfriend();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  if (list.isPending) {
    return <ListSkeleton count={4} />;
  }
  if (list.isError) {
    return <QueryError onRetry={() => list.refetch()} retrying={list.isFetching} />;
  }
  const data = list.data;
  return (
    <div className="friends-list">
      <Link className={buttonVariants()} to="/friends/invite">
        招待する
      </Link>
      <Link className={buttonVariants({ variant: "secondary" })} to="/friends/join">
        {SOCIAL_COPY.pasteInvite}
      </Link>
      {data?.incoming.length ? <h2 className="friends-section">届いた申請</h2> : null}
      {data?.incoming.map((request) => (
        <div key={request.id} className="friends-row">
          <SocialAvatar profile={request.peer} />
          <span className="friends-row-name">{request.peer.nickname}</span>
          <Button
            type="button"
            disabled={busyId === request.id}
            onClick={() => {
              setBusyId(request.id);
              accept.mutate(request.id, {
                onSuccess: () => {
                  showToast({ message: socialBecameFriendsMessage(request.peer.nickname) });
                  navigate("/", { replace: true });
                },
                onSettled: () => setBusyId(null),
              });
            }}
          >
            承認
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busyId === request.id}
            onClick={() => decline.mutate(request.id)}
          >
            辞退
          </Button>
        </div>
      ))}
      {data?.outgoing.length ? <h2 className="friends-section">申請中</h2> : null}
      {data?.outgoing.map((request) => (
        <div key={request.id} className="friends-row">
          <SocialAvatar profile={request.peer} />
          <span className="friends-row-name">{request.peer.nickname}</span>
          <Button type="button" variant="ghost" onClick={() => cancel.mutate(request.id)}>
            取り消す
          </Button>
        </div>
      ))}
      <h2 className="friends-section">友達</h2>
      {data?.friends.length === 0 ? <p className="share-field-hint">まだ友達はいません</p> : null}
      {data?.friends.map((friend) => (
        <div key={friend.userId} className="friends-row">
          <Link className="friends-row-link" to={`/friends/profile/${friend.userId}`}>
            <SocialAvatar profile={friend} />
            <span className="friends-row-name">{friend.nickname}</span>
          </Link>
          <Button type="button" variant="ghost" onClick={() => setTarget(friend.userId)}>
            解除
          </Button>
        </div>
      ))}
      <Dialog
        open={Boolean(target)}
        title="友達を解除しますか"
        body="解除すると、これまでの共有は見えなくなります。もう一度友達になるには申請と承認が必要です。"
        primaryLabel="解除する"
        destructive
        onPrimary={() => {
          if (target) {
            unfriend.mutate(target);
          }
          setTarget(null);
        }}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

export function FriendsInvitePage() {
  const ownToken = readOwnInviteToken() ?? undefined;
  const invitation = useFriendInvitation(ownToken);
  const create = useCreateInvitation();
  const reissue = useReissueInvitation();
  const { showToast } = useToast();
  useEffect(() => {
    if (invitation.data?.url) {
      rememberOwnInviteToken(invitation.data.url);
    }
  }, [invitation.data?.url]);
  if (invitation.isPending) {
    return <CardSkeleton />;
  }
  if (invitation.isError && !invitation.data) {
    return (
      <div className="friends-invite">
        <Button type="button" onClick={() => create.mutate()}>
          招待リンクを作る
        </Button>
      </div>
    );
  }
  const data = invitation.data;
  return (
    <div className="friends-invite">
      <p className="share-field-hint">
        同じリンクをコピーするか、QR を見せてください。有効期限は 7 日です。
      </p>
      {data ? (
        <>
          <p className="friends-invite-url">{data.url}</p>
          <img
            className="friends-invite-qr"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(data.qrSvg)}`}
            alt="招待QR"
          />
          <Button
            type="button"
            onClick={() => {
              void copyText(data.url).then((ok) => {
                if (ok) {
                  showToast({ message: "コピーしました" });
                  return;
                }
                showToast({
                  message: "コピーできませんでした。リンクを長押ししてコピーしてください",
                });
              });
            }}
          >
            リンクをコピー
          </Button>
          {typeof navigator.share === "function" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void navigator.share({
                  title: SOCIAL_COPY.inviteShareText,
                  url: data.url,
                  text: SOCIAL_COPY.inviteShareText,
                })
              }
            >
              端末の共有
            </Button>
          ) : null}
          <p className="share-field-caption">
            期限 {new Date(data.expiresAt).toLocaleString("ja-JP")}
          </p>
        </>
      ) : null}
      <Button type="button" variant="ghost" onClick={() => reissue.mutate()}>
        再発行する
      </Button>
    </div>
  );
}

export function FriendsProfilePage() {
  const { id } = useParams();
  const profile = useSocialProfile(id);
  const posts = useSocialProfilePosts(id);
  if (profile.isPending) {
    return <CardSkeleton />;
  }
  if (profile.isError) {
    return isApiClientError(profile.error) && profile.error.code === "not_found" ? (
      <NotFoundPage />
    ) : (
      <QueryError onRetry={() => profile.refetch()} retrying={profile.isFetching} />
    );
  }
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="friends-profile">
      <div className="friends-row">
        <SocialAvatar profile={profile.data} size={56} />
        <h2 className="friends-row-name">{profile.data.nickname}</h2>
      </div>
      {items.map((post) => (
        <PostCard key={post.id} post={post} compact />
      ))}
    </div>
  );
}

export function FriendsPostPage() {
  const { id } = useParams();
  const query = useSocialPost(id);
  const unshare = useUnsharePost();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (query.isPending) {
    return <CardSkeleton />;
  }
  if (query.isError) {
    return isApiClientError(query.error) && query.error.code === "not_found" ? (
      <NotFoundPage />
    ) : (
      <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
    );
  }
  const post = query.data;
  return (
    <article className="social-post">
      <header className="social-card-head">
        <SocialAvatar profile={post.author} />
        <div>
          <p className="social-card-name">{post.author.nickname}</p>
          <p className="social-card-meta">
            {formatRelativeShareTime(post.publishedAt)} ·{" "}
            {socialKindLabel(post.kind, post.items.length)}
            {post.edited ? " · 編集済み" : ""}
          </p>
        </div>
      </header>
      {post.items.map((item) => (
        <PostDetailItem
          key={`${item.name}-${item.drunkOn ?? item.openedOn ?? ""}-${item.photoIds[0] ?? ""}`}
          postId={post.id}
          item={item}
          compact={post.items.length > 1}
        />
      ))}
      <ReactionBar postId={post.id} reactions={post.reactions} canReact={post.canReact} />
      {post.isAuthor ? (
        <div className="social-post-actions">
          {post.sourceDrinkLogId ? (
            <Link
              className={buttonVariants({ variant: "secondary" })}
              to={`/logs/entries/${post.sourceDrinkLogId}/edit`}
            >
              記録を編集
            </Link>
          ) : null}
          {post.sourceBottleId ? (
            <Link
              className={buttonVariants({ variant: "secondary" })}
              to={`/cellar/${post.sourceBottleId}/edit`}
            >
              ボトルを編集
            </Link>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setConfirm(true)}>
            共有を取り消す
          </Button>
        </div>
      ) : null}
      <Dialog
        open={confirm}
        title="共有を取り消しますか"
        body="投稿とリアクションは削除されます。個人の記録は残ります。"
        primaryLabel="取り消す"
        destructive
        onPrimary={() => {
          unshare.mutate(post.id, { onSuccess: () => navigate("/friends") });
          setConfirm(false);
        }}
        onClose={() => setConfirm(false)}
      />
    </article>
  );
}

export function FriendsNotificationsPage() {
  const list = useSocialNotifications();
  const mark = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  if (list.isPending) {
    return <ListSkeleton count={4} />;
  }
  if (list.isError) {
    return <QueryError onRetry={() => list.refetch()} retrying={list.isFetching} />;
  }
  return (
    <div className="friends-notifications">
      <Button type="button" variant="ghost" onClick={() => markAll.mutate()}>
        すべて既読
      </Button>
      {items.length === 0 ? <p className="share-field-hint">通知はありません</p> : null}
      {items.map((item) => (
        <div key={item.id} className={item.readAt ? "friends-notice" : "friends-notice is-unread"}>
          {item.href ? (
            <Link to={item.href} onClick={() => mark.mutate(item.id)}>
              {item.body}
            </Link>
          ) : (
            <p>{item.body}</p>
          )}
          {item.canRespond && item.requestId ? (
            <div className="friends-row">
              <Button
                type="button"
                disabled={busyId === item.requestId}
                onClick={() => {
                  const requestId = item.requestId ?? "";
                  setBusyId(requestId);
                  accept.mutate(requestId, {
                    onSuccess: () => {
                      showToast({
                        message: socialBecameFriendsMessage(item.actor?.nickname ?? "ユーザー"),
                      });
                      navigate("/", { replace: true });
                    },
                    onSettled: () => setBusyId(null),
                  });
                }}
              >
                承認
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busyId === item.requestId}
                onClick={() => decline.mutate(item.requestId ?? "")}
              >
                辞退
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SettingsProfilePage() {
  const me = useSocialMe();
  const update = useUpdateSocialProfile();
  const upload = useUploadSocialAvatar();
  const remove = useDeleteSocialAvatar();
  const { showToast } = useToast();
  const [color, setColor] = useState(DEFAULT_MASCOT_COLOR);
  useEffect(() => {
    if (me.data) {
      setColor(me.data.mascotColor || DEFAULT_MASCOT_COLOR);
    }
  }, [me.data]);
  if (me.isPending) {
    return <ListSkeleton count={3} />;
  }
  if (me.isError) {
    return <QueryError onRetry={() => me.refetch()} retrying={me.isFetching} />;
  }
  return (
    <div className="settings-profile">
      {me.data ? <SocialAvatar profile={me.data} size={72} /> : null}
      <p className="share-field-hint">{SOCIAL_COPY.profileName}</p>
      <p className="share-field-caption">名前は設定の表示名を使います。アイコンは任意です。</p>
      <div className="mascot-color-row">
        {MASCOT_COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={preset === color ? "mascot-swatch is-current" : "mascot-swatch"}
            style={{ background: preset }}
            aria-label={preset}
            onClick={() => setColor(preset)}
          />
        ))}
        <input
          type="color"
          value={color}
          aria-label="液体の色"
          onChange={(event) => setColor(event.target.value.toUpperCase())}
        />
      </div>
      <Button
        type="button"
        onClick={() =>
          update.mutate(
            { mascotColor: color },
            { onSuccess: () => showToast({ message: "保存しました" }) },
          )
        }
      >
        色を保存する
      </Button>
      <label className={buttonVariants({ variant: "secondary" })}>
        画像を選ぶ
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              upload.mutate(file, { onSuccess: () => showToast({ message: "保存しました" }) });
            }
          }}
        />
      </label>
      {me.data?.hasCustomAvatar ? (
        <Button type="button" variant="ghost" onClick={() => remove.mutate()}>
          ワイン君に戻す
        </Button>
      ) : null}
    </div>
  );
}

export function SettingsBlocksPage() {
  const blocks = useBlocks();
  const unblock = useUnblockUser();
  if (blocks.isPending) {
    return <ListSkeleton count={3} />;
  }
  if (blocks.isError) {
    return <QueryError onRetry={() => blocks.refetch()} retrying={blocks.isFetching} />;
  }
  return (
    <div className="friends-list">
      {blocks.data?.items.length === 0 ? (
        <p className="share-field-hint">ブロックした相手はいません</p>
      ) : null}
      {blocks.data?.items.map((item) => (
        <div key={item.userId} className="friends-row">
          <SocialAvatar profile={item} />
          <span className="friends-row-name">{item.nickname}</span>
          <Button type="button" variant="ghost" onClick={() => unblock.mutate(item.userId)}>
            解除
          </Button>
        </div>
      ))}
    </div>
  );
}
