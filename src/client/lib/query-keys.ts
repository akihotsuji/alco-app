/**
 * TanStack Query の queryKey はここに集める。
 * 先頭がリソース名、以降が絞り込み条件の配列（例: `["drink-logs", { from, to }]`）。
 * mutation 成功後は同じリソース名の先頭要素で `invalidateQueries` する。
 */
export const queryKeys = {
  me: ["me"] as const,
  publicConfig: ["public-config"] as const,
  photos: ["photos"] as const,
  drinkLogs: ["drink-logs"] as const,
  drinkLogsDay: (date: string) => ["drink-logs", { date }] as const,
  drinkLog: (id: string) => ["drink-logs", id] as const,
  drinkLogSummaries: ["drink-log-summaries"] as const,
  drinkLogSummary: (period: "day" | "week" | "month", date: string) =>
    ["drink-log-summaries", { period, date }] as const,
  myDrinks: ["my-drinks"] as const,
  myDrink: (id: string) => ["my-drinks", id] as const,
  cellars: ["cellars"] as const,
  cellarsList: ["cellars", "list"] as const,
  cellar: (id: string) => ["cellars", id] as const,
  cellarRevision: (id: string) => ["cellars", id, "revision"] as const,
  cellarMembers: (id: string) => ["cellars", id, "members"] as const,
  cellarInvitations: (id: string) => ["cellars", id, "invitations"] as const,
  cellarActivity: (id: string) => ["cellars", id, "activity"] as const,
  bottles: ["bottles"] as const,
  bottlesList: (query: {
    view?: string;
    q?: string;
    drinkType?: string;
    group?: string;
    limit?: number;
    cellarId?: string;
    scope?: string;
  }) => ["bottles", query] as const,
  bottle: (id: string) => ["bottles", id] as const,
  drinkLogsByBottle: (bottleId: string) => ["drink-logs", { bottleId }] as const,
  tastingNotes: ["tasting-notes"] as const,
  tastingNotesList: (query: {
    bottleId?: string;
    q?: string;
    drinkType?: string;
    ratingX10Min?: number;
    limit?: number;
  }) => ["tasting-notes", query] as const,
  tastingNote: (id: string) => ["tasting-notes", id] as const,
  socialMe: ["social-me"] as const,
  socialPreferences: ["social-preferences"] as const,
  socialFeed: ["social-feed"] as const,
  socialPost: (id: string) => ["social-posts", id] as const,
  socialProfile: (id: string) => ["social-profiles", id] as const,
  socialProfilePosts: (id: string) => ["social-profiles", id, "posts"] as const,
  socialSources: (query: {
    bottleId?: string;
    drinkLogId?: string;
    registrationBatchId?: string;
  }) => ["social-sources", query] as const,
  friends: ["friends"] as const,
  friendInvitation: ["friend-invitation"] as const,
  friendBlocks: ["friend-blocks"] as const,
  socialNotifications: ["social-notifications"] as const,
  socialUnread: ["social-unread"] as const,
  reactionTypes: ["reaction-types"] as const,
} as const;
