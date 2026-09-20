import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AuthBoot } from "@/client/auth/AuthBoot.tsx";
import { loginPathFor } from "@/client/auth/login-path.ts";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { CardSkeleton, ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { PostCard } from "@/client/components/friends/PostCard.tsx";
import { ReactionBar } from "@/client/components/friends/ReactionBar.tsx";
import { SocialAvatar } from "@/client/components/friends/SocialAvatar.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useSessionBoot } from "@/client/hooks/use-session-boot.ts";
import {
  socialPhotoContentUrl,
  useAcceptFriendRequest,
  useBlocks,
  useCancelFriendRequest,
  useCreateFriendRequest,
  useCreateInvitation,
  useDeclineFriendRequest,
  useDeleteSocialAvatar,
  useFriendInvitation,
  useFriends,
  useInvitePreview,
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
  captureFriendJoinToken,
  readOwnInviteToken,
  rememberOwnInviteToken,
} from "@/client/lib/social-invite.ts";
import { formatRelativeShareTime } from "@/client/lib/social-time.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { DEFAULT_MASCOT_COLOR, MASCOT_COLOR_PRESETS, SOCIAL_COPY, socialKindLabel } from "@/shared/social.ts";
import { PWA_NAME } from "@/shared/pwa.ts";
import { formatRatingX10 } from "@/shared/tasting-notes.ts";

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
      <EmptyState
        pose="default"
        message={friendCount === 0 ? SOCIAL_COPY.feedEmptyNoFriends : SOCIAL_COPY.feedEmptyNoPosts}
        actionLabel={friendCount === 0 ? "友達を招待" : undefined}
        actionTo={friendCount === 0 ? "/friends/invite" : undefined}
      />
    );
  }
  return (
    <div className="friends-feed">
      {items.map((post) => (
        <PostCard key={post.id} post={post} compact />
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
  const [target, setTarget] = useState<string | null>(null);
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
      {data?.incoming.length ? <h2 className="friends-section">届いた申請</h2> : null}
      {data?.incoming.map((request) => (
        <div key={request.id} className="friends-row">
          <SocialAvatar profile={request.peer} />
          <span>{request.peer.nickname}</span>
          <Button type="button" onClick={() => accept.mutate(request.id)}>
            承認
          </Button>
          <Button type="button" variant="ghost" onClick={() => decline.mutate(request.id)}>
            辞退
          </Button>
        </div>
      ))}
      {data?.outgoing.length ? <h2 className="friends-section">申請中</h2> : null}
      {data?.outgoing.map((request) => (
        <div key={request.id} className="friends-row">
          <SocialAvatar profile={request.peer} />
          <span>{request.peer.nickname}</span>
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
            <span>{friend.nickname}</span>
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
      <p className="share-field-hint">同じリンクをコピーするか、QR を見せてください。有効期限は 7 日です。</p>
      {data ? (
        <>
          <p className="friends-invite-url">{data.url}</p>
          <img className="friends-invite-qr" src={`data:image/svg+xml;utf8,${encodeURIComponent(data.qrSvg)}`} alt="招待QR" />
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(data.url);
              showToast({ message: "コピーしました" });
            }}
          >
            リンクをコピー
          </Button>
          {typeof navigator.share === "function" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void navigator.share({ title: SOCIAL_COPY.inviteShareText, url: data.url, text: SOCIAL_COPY.inviteShareText })}
            >
              端末の共有
            </Button>
          ) : null}
          <p className="share-field-caption">期限 {new Date(data.expiresAt).toLocaleString("ja-JP")}</p>
        </>
      ) : null}
      <Button type="button" variant="ghost" onClick={() => reissue.mutate()}>
        再発行する
      </Button>
    </div>
  );
}

export function FriendsJoinPage() {
  const boot = useSessionBoot();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(
      captureFriendJoinToken(window.location.hash, (url) => {
        window.history.replaceState(window.history.state, "", url);
      }),
    );
  }, []);
  const preview = useInvitePreview(token);
  const request = useCreateFriendRequest();
  const me = useSocialMe();

  if (boot.kind === "loading" || boot.kind === "slow") {
    return <AuthBoot variant={boot.variant ?? undefined} onRetry={boot.retry} retrying={boot.retrying} />;
  }
  if (boot.kind !== "authenticated") {
    return (
      <main className="join-page">
        <h1>{PWA_NAME}</h1>
        <p>酒のしおりで友達になるには、ログインしてください。</p>
        <Link className={buttonVariants()} to={loginPathFor("/friends/join")}>
          ログインしてはじめる
        </Link>
      </main>
    );
  }
  if (!me.data?.profileCompleted) {
    return (
      <main className="join-page">
        <p>先に、友達に表示する名前を設定してください。</p>
        <Link className={buttonVariants()} to="/settings/profile">
          プロフィールを設定
        </Link>
      </main>
    );
  }
  if (!token || preview.data?.status === "unavailable") {
    return (
      <main className="join-page">
        <p>招待リンクが正しくないか、期限が切れています。</p>
        <Link className={buttonVariants({ variant: "secondary" })} to="/friends">
          友達の近況へ
        </Link>
      </main>
    );
  }
  if (preview.isPending) {
    return <CardSkeleton />;
  }
  const profile = preview.data?.profile;
  return (
    <main className="join-page">
      <h1>友達申請</h1>
      {profile ? (
        <>
          <SocialAvatar profile={profile} size={64} />
          <p>{profile.nickname}</p>
        </>
      ) : null}
      {preview.data?.alreadyFriends ? <p>すでに友達です。</p> : null}
      {preview.data?.alreadyRequested ? <p>申請済みです。相手の承認を待っています。</p> : null}
      {preview.data?.reversePending ? <p>相手からの申請が届いています。友達一覧で確認してください。</p> : null}
      {!preview.data?.alreadyFriends && !preview.data?.alreadyRequested && !preview.data?.reversePending ? (
        <Button type="button" onClick={() => token && request.mutate(token)} disabled={request.isPending}>
          友達申請を送る
        </Button>
      ) : null}
    </main>
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
        <h2>{profile.data.nickname}</h2>
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
  const [tastingOpen, setTastingOpen] = useState(false);
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
            {formatRelativeShareTime(post.publishedAt)} · {socialKindLabel(post.kind, post.items.length)}
            {post.edited ? " · 編集済み" : ""}
          </p>
        </div>
      </header>
      {post.items.map((item) => (
        <section key={`${item.name}-${item.drunkOn ?? item.openedOn ?? ""}`} className="social-post-item">
          {item.photoIds.map((photoId) => (
            <img key={photoId} className="social-card-photo" src={socialPhotoContentUrl(post.id, photoId)} alt="" />
          ))}
          <h2>{item.name}</h2>
          {item.producer ? <p>{item.producer}</p> : null}
          {item.origin ? <p>{item.origin}</p> : null}
          {item.variety ? <p>{item.variety}</p> : null}
          {item.vintage ? <p>{item.vintage}</p> : null}
          {item.drunkOn ? <p>飲んだ日 {item.drunkOn}</p> : null}
          {item.openedOn ? <p>開栓した日 {item.openedOn}</p> : null}
          {item.ratingX10 != null ? <p>{formatRatingX10(item.ratingX10)}</p> : null}
          {item.comment ? <p>{item.comment}</p> : null}
          {item.tasting ? (
            <div>
              <Button type="button" variant="ghost" onClick={() => setTastingOpen((value) => !value)}>
                詳しく見る
              </Button>
              {tastingOpen ? (
                <dl className="social-tasting">
                  {item.tasting.appearance ? <><dt>外観</dt><dd>{item.tasting.appearance}</dd></> : null}
                  {item.tasting.aroma ? <><dt>香り</dt><dd>{item.tasting.aroma}</dd></> : null}
                  {item.tasting.taste ? <><dt>味わい</dt><dd>{item.tasting.taste}</dd></> : null}
                  {item.tasting.finish ? <><dt>余韻</dt><dd>{item.tasting.finish}</dd></> : null}
                </dl>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
      <ReactionBar postId={post.id} reactions={post.reactions} canReact={post.canReact} />
      {post.isAuthor && post.sourceDrinkLogId ? (
        <Link className={buttonVariants({ variant: "secondary" })} to={`/logs/entries/${post.sourceDrinkLogId}/edit`}>
          記録を編集
        </Link>
      ) : null}
      {post.isAuthor && post.sourceBottleId ? (
        <Link className={buttonVariants({ variant: "secondary" })} to={`/cellar/${post.sourceBottleId}/edit`}>
          ボトルを編集
        </Link>
      ) : null}
      {post.isAuthor ? (
        <Button type="button" variant="ghost" onClick={() => setConfirm(true)}>
          共有を取り消す
        </Button>
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
              <Button type="button" onClick={() => accept.mutate(item.requestId ?? "")}>
                承認
              </Button>
              <Button type="button" variant="ghost" onClick={() => decline.mutate(item.requestId ?? "")}>
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
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState(DEFAULT_MASCOT_COLOR);
  useEffect(() => {
    if (me.data) {
      setNickname(me.data.nickname);
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
      {me.data ? <SocialAvatar profile={{ ...me.data, nickname: nickname || me.data.nickname }} size={72} /> : null}
      <label className="field-label">
        {SOCIAL_COPY.profileName}
        <Input
          value={nickname}
          maxLength={30}
          autoComplete="off"
          onChange={(event) => setNickname(event.target.value)}
        />
      </label>
      <p className="share-field-caption">本名は自動では入れません。友達に見せる名前だけを書いてください。</p>
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
            { nickname, mascotColor: color, avatarMode: "mascot" },
            { onSuccess: () => showToast({ message: "保存しました" }) },
          )
        }
      >
        保存する
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
          ワイン君の色に戻す
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
      {blocks.data?.items.length === 0 ? <p className="share-field-hint">ブロックした相手はいません</p> : null}
      {blocks.data?.items.map((item) => (
        <div key={item.userId} className="friends-row">
          <SocialAvatar profile={item} />
          <span>{item.nickname}</span>
          <Button type="button" variant="ghost" onClick={() => unblock.mutate(item.userId)}>
            解除
          </Button>
        </div>
      ))}
    </div>
  );
}
