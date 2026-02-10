/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Bluesky / AT Protocol Type Definitions
   ────────────────────────────────────────────────────────── */

// ── Session & Auth ──────────────────────────────────────

export interface SessionData {
  did: string;
  handle: string;
  email?: string;
  emailConfirmed?: boolean;
  emailAuthFactor?: boolean;
  accessJwt: string;
  refreshJwt: string;
  active?: boolean;
}

// ── Profiles ────────────────────────────────────────────

export interface ProfileViewBasic {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  associated?: {
    lists?: number;
    feedgens?: number;
    starterPacks?: number;
    labeler?: boolean;
    chat?: { allowIncoming: string };
  };
  viewer?: ViewerState;
  labels?: Label[];
  createdAt?: string;
}

export interface ProfileViewDetailed extends ProfileViewBasic {
  banner?: string;
  description?: string;
  followsCount?: number;
  followersCount?: number;
  postsCount?: number;
  indexedAt?: string;
  pinnedPost?: StrongRef;
}

export interface ViewerState {
  muted?: boolean;
  mutedByList?: ListViewBasic;
  blockedBy?: boolean;
  blocking?: string;
  blockingByList?: ListViewBasic;
  following?: string;
  followedBy?: string;
  knownFollowers?: {
    count: number;
    followers: ProfileViewBasic[];
  };
}

// ── Posts & Feed ────────────────────────────────────────

export interface StrongRef {
  uri: string;
  cid: string;
}

export interface PostRecord {
  $type: 'app.bsky.feed.post';
  text: string;
  facets?: Facet[];
  reply?: ReplyRef;
  embed?: PostEmbed;
  langs?: string[];
  labels?: SelfLabels;
  tags?: string[];
  createdAt: string;
}

export interface ReplyRef {
  root: StrongRef;
  parent: StrongRef;
}

export interface PostEmbed {
  $type: string;
  images?: ImageEmbed[];
  external?: ExternalEmbed;
  record?: StrongRef;
  media?: PostEmbed;
  video?: BlobRef;
  alt?: string;
}

export interface ImageEmbed {
  alt: string;
  image: BlobRef;
  aspectRatio?: { width: number; height: number };
}

export interface ExternalEmbed {
  uri: string;
  title: string;
  description: string;
  thumb?: BlobRef;
}

export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: FacetFeature[];
}

export type FacetFeature =
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string };

export interface SelfLabels {
  $type: 'com.atproto.label.defs#selfLabels';
  values: { val: string }[];
}

export interface Label {
  ver?: number;
  src: string;
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts: string;
  exp?: string;
  sig?: string;
}

// ── Feed Views ──────────────────────────────────────────

export interface FeedViewPost {
  post: PostView;
  reply?: {
    root: PostView | NotFoundPost | BlockedPost;
    parent: PostView | NotFoundPost | BlockedPost;
    grandparentAuthor?: ProfileViewBasic;
  };
  reason?: ReasonRepost;
  feedContext?: string;
}

export interface PostView {
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  record: PostRecord;
  embed?: EmbedView;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  indexedAt: string;
  viewer?: PostViewerState;
  labels?: Label[];
  threadgate?: ThreadgateView;
}

export interface PostViewerState {
  like?: string;
  repost?: string;
  threadMuted?: boolean;
  replyDisabled?: boolean;
  embeddingDisabled?: boolean;
  pinned?: boolean;
}

export interface NotFoundPost {
  uri: string;
  notFound: true;
}

export interface BlockedPost {
  uri: string;
  blocked: true;
  author: { did: string };
}

export interface ReasonRepost {
  $type: 'app.bsky.feed.defs#reasonRepost';
  by: ProfileViewBasic;
  indexedAt: string;
}

// ── Embed Views ─────────────────────────────────────────

export interface EmbedView {
  $type: string;
  images?: EmbedImageView[];
  external?: EmbedExternalView;
  record?: EmbedRecordView;
  media?: EmbedView;
  playlist?: string;
  thumbnail?: string;
  alt?: string;
  aspectRatio?: { width: number; height: number };
}

export interface EmbedImageView {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number };
}

export interface EmbedExternalView {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
}

export interface EmbedRecordView {
  record:
    | EmbedRecordViewRecord
    | EmbedRecordViewNotFound
    | EmbedRecordViewBlocked;
}

export interface EmbedRecordViewRecord {
  $type: 'app.bsky.embed.record#viewRecord';
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  value: PostRecord;
  labels?: Label[];
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  embeds?: EmbedView[];
  indexedAt: string;
}

export interface EmbedRecordViewNotFound {
  $type: 'app.bsky.embed.record#viewNotFound';
  uri: string;
  notFound: true;
}

export interface EmbedRecordViewBlocked {
  $type: 'app.bsky.embed.record#viewBlocked';
  uri: string;
  blocked: true;
  author: { did: string };
}

// ── Thread ──────────────────────────────────────────────

export interface ThreadViewPost {
  $type: 'app.bsky.feed.defs#threadViewPost';
  post: PostView;
  parent?: ThreadViewPost | NotFoundPost | BlockedPost;
  replies?: (ThreadViewPost | NotFoundPost | BlockedPost)[];
}

// ── Notifications ───────────────────────────────────────

export interface Notification {
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  reason:
    | 'like'
    | 'repost'
    | 'follow'
    | 'mention'
    | 'reply'
    | 'quote'
    | 'starterpack-joined';
  reasonSubject?: string;
  record: Record<string, unknown>;
  isRead: boolean;
  indexedAt: string;
  labels?: Label[];
}

// ── Lists ───────────────────────────────────────────────

export interface ListViewBasic {
  uri: string;
  cid: string;
  name: string;
  purpose: string;
  avatar?: string;
  listItemCount?: number;
  labels?: Label[];
  viewer?: { muted?: boolean; blocked?: string };
  indexedAt?: string;
}

// ── Thread Gate ─────────────────────────────────────────

export interface ThreadgateView {
  uri?: string;
  cid?: string;
  record?: Record<string, unknown>;
  lists?: ListViewBasic[];
}

// ── API Response Wrappers ───────────────────────────────

export interface TimelineResponse {
  feed: FeedViewPost[];
  cursor?: string;
}

export interface AuthorFeedResponse {
  feed: FeedViewPost[];
  cursor?: string;
}

export interface ThreadResponse {
  thread: ThreadViewPost | NotFoundPost | BlockedPost;
}

export interface NotificationsResponse {
  notifications: Notification[];
  cursor?: string;
  seenAt?: string;
}

export interface SearchActorsResponse {
  actors: ProfileViewBasic[];
  cursor?: string;
}

export interface SearchPostsResponse {
  posts: PostView[];
  cursor?: string;
  hitsTotal?: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface UploadBlobResponse {
  blob: BlobRef;
}

export interface CreateRecordResponse {
  uri: string;
  cid: string;
}

// ── Follows / Followers ─────────────────────────────────

export interface FollowsResponse {
  subject: ProfileViewBasic;
  follows: ProfileViewBasic[];
  cursor?: string;
}

export interface FollowersResponse {
  subject: ProfileViewBasic;
  followers: ProfileViewBasic[];
  cursor?: string;
}

// ── Likes / Reposted-by / Quotes ────────────────────────

export interface LikeItem {
  createdAt: string;
  indexedAt: string;
  actor: ProfileViewBasic;
}

export interface GetLikesResponse {
  uri: string;
  cid?: string;
  likes: LikeItem[];
  cursor?: string;
}

export interface RepostedByResponse {
  uri: string;
  cid?: string;
  repostedBy: ProfileViewBasic[];
  cursor?: string;
}

export interface GetQuotesResponse {
  uri: string;
  cid?: string;
  posts: PostView[];
  cursor?: string;
}

// ── Video Upload ────────────────────────────────────────

export interface VideoUploadResponse {
  jobId: string;
}

export interface VideoJobStatus {
  jobId: string;
  did: string;
  state: 'JOB_STATE_CREATED' | 'JOB_STATE_PROCESSING' | 'JOB_STATE_COMPLETED' | 'JOB_STATE_FAILED';
  progress?: number;
  blob?: BlobRef;
  error?: string;
}

export interface VideoUploadLimits {
  canUpload: boolean;
  remainingDailyVideos?: number;
  remainingDailyBytes?: number;
  message?: string;
  error?: string;
}

// ── Mutes & Blocks ──────────────────────────────────────

export interface MutesResponse {
  mutes: ProfileViewBasic[];
  cursor?: string;
}

export interface BlocksResponse {
  blocks: ProfileViewBasic[];
  cursor?: string;
}
