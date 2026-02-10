/* ──────────────────────────────────────────────────────────
   HoboSky v0.3.0 — Bluesky AT Protocol API Service
   ────────────────────────────────────────────────────────── */

import type {
  SessionData,
  ProfileViewDetailed,
  ProfileViewBasic,
  TimelineResponse,
  AuthorFeedResponse,
  ThreadResponse,
  NotificationsResponse,
  SearchActorsResponse,
  SearchPostsResponse,
  UnreadCountResponse,
  UploadBlobResponse,
  CreateRecordResponse,
  FollowsResponse,
  FollowersResponse,
  GetLikesResponse,
  RepostedByResponse,
  GetQuotesResponse,
  VideoJobStatus,
  VideoUploadLimits,
  MutesResponse,
  BlocksResponse,
  ListConvosResponse,
  GetConvoResponse,
  GetMessagesResponse,
  ChatMessageView,
  GetFeedGeneratorsResponse,
  GetSuggestedFeedsResponse,
  GetFeedResponse,
  GeneratorView,
  GetPreferencesResponse,
  GetListResponse,
  GetListsResponse,
  GetListFeedResponse,
  ListView,
  GetBookmarksResponse,
  TypeaheadResponse,
  StrongRef,
  Facet,
  PostEmbed,
} from '../types';

const DEFAULT_SERVICE = 'https://bsky.social';
const STORAGE_KEY_SESSION = 'hobosky_session';
const STORAGE_KEY_SERVICE = 'hobosky_service';

type SessionChangeCallback = (session: SessionData | null) => void;

class BlueskyAPI {
  private service: string;
  private session: SessionData | null = null;
  private refreshPromise: Promise<void> | null = null;
  private listeners: Set<SessionChangeCallback> = new Set();

  constructor() {
    this.service = localStorage.getItem(STORAGE_KEY_SERVICE) || DEFAULT_SERVICE;
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    if (stored) {
      try {
        this.session = JSON.parse(stored);
      } catch {
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    }
  }

  // ── Session Listeners ───────────────────────────────

  onSessionChange(cb: SessionChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.session));
  }

  private persistSession(): void {
    if (this.session) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(this.session));
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    }
    this.notifyListeners();
  }

  // ── Getters ─────────────────────────────────────────

  getSession(): SessionData | null {
    return this.session;
  }

  getDid(): string | null {
    return this.session?.did ?? null;
  }

  getHandle(): string | null {
    return this.session?.handle ?? null;
  }

  isAuthenticated(): boolean {
    return this.session !== null;
  }

  // ── Core HTTP ───────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    nsid: string,
    params?: Record<string, string | number | boolean | string[] | undefined>,
    body?: unknown,
    options?: {
      noAuth?: boolean;
      contentType?: string;
      rawBody?: Blob | ArrayBuffer;
      proxy?: string;
    }
  ): Promise<T> {
    let url = `${this.service}/xrpc/${nsid}`;

    if (method === 'GET' && params) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          if (Array.isArray(v)) {
            v.forEach((item) => search.append(k, String(item)));
          } else {
            search.set(k, String(v));
          }
        }
      });
      const qs = search.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {};

    if (!options?.noAuth && this.session) {
      headers['Authorization'] = `Bearer ${this.session.accessJwt}`;
    }

    if (options?.proxy) {
      headers['atproto-proxy'] = options.proxy;
    }

    let bodyContent: string | Blob | ArrayBuffer | undefined;
    if (options?.rawBody) {
      headers['Content-Type'] = options.contentType || 'application/octet-stream';
      bodyContent = options.rawBody;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      bodyContent = JSON.stringify(body);
    }

    let response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? bodyContent : undefined,
    });

    // Auto-refresh on 401
    if (response.status === 401 && this.session && !options?.noAuth) {
      await this.refreshSession();
      headers['Authorization'] = `Bearer ${this.session!.accessJwt}`;
      response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? bodyContent : undefined,
      });
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        (errorBody as Record<string, string>).error || 'UnknownError',
        (errorBody as Record<string, string>).message || response.statusText
      );
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  // ── Auth ────────────────────────────────────────────

  async login(
    identifier: string,
    password: string,
    service?: string
  ): Promise<SessionData> {
    if (service) {
      this.service = service;
      localStorage.setItem(STORAGE_KEY_SERVICE, service);
    }

    const session = await this.request<SessionData>(
      'POST',
      'com.atproto.server.createSession',
      undefined,
      { identifier, password },
      { noAuth: true }
    );

    this.session = session;
    this.persistSession();
    return session;
  }

  async logout(): Promise<void> {
    if (this.session) {
      try {
        await this.request('POST', 'com.atproto.server.deleteSession');
      } catch {
        // Best effort
      }
    }
    this.session = null;
    this.persistSession();
  }

  async refreshSession(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      if (!this.session?.refreshJwt) {
        this.session = null;
        this.persistSession();
        throw new Error('No refresh token');
      }

      try {
        const response = await fetch(
          `${this.service}/xrpc/com.atproto.server.refreshSession`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.session.refreshJwt}`,
            },
          }
        );

        if (!response.ok) {
          this.session = null;
          this.persistSession();
          throw new Error('Session refresh failed');
        }

        const newSession: SessionData = await response.json();
        this.session = newSession;
        this.persistSession();
      } catch (err) {
        this.session = null;
        this.persistSession();
        throw err;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async resumeSession(): Promise<SessionData | null> {
    if (!this.session) return null;

    try {
      const session = await this.request<SessionData>(
        'GET',
        'com.atproto.server.getSession'
      );
      this.session = { ...this.session, ...session };
      this.persistSession();
      return this.session;
    } catch {
      try {
        await this.refreshSession();
        return this.session;
      } catch {
        return null;
      }
    }
  }

  // ── Timeline & Feeds ────────────────────────────────

  async getTimeline(cursor?: string, limit = 50): Promise<TimelineResponse> {
    return this.request('GET', 'app.bsky.feed.getTimeline', {
      cursor,
      limit,
    });
  }

  async getAuthorFeed(
    actor: string,
    cursor?: string,
    limit = 50,
    filter = 'posts_with_replies'
  ): Promise<AuthorFeedResponse> {
    return this.request('GET', 'app.bsky.feed.getAuthorFeed', {
      actor,
      cursor,
      limit,
      filter,
    });
  }

  async getActorLikes(
    actor: string,
    cursor?: string,
    limit = 50
  ): Promise<AuthorFeedResponse> {
    return this.request('GET', 'app.bsky.feed.getActorLikes', {
      actor,
      cursor,
      limit,
    });
  }

  // ── Posts ───────────────────────────────────────────

  async getPostThread(
    uri: string,
    depth = 6,
    parentHeight = 80
  ): Promise<ThreadResponse> {
    return this.request('GET', 'app.bsky.feed.getPostThread', {
      uri,
      depth,
      parentHeight,
    });
  }

  async createPost(
    text: string,
    opts?: {
      reply?: { root: StrongRef; parent: StrongRef };
      embed?: PostEmbed;
      facets?: Facet[];
      langs?: string[];
    }
  ): Promise<CreateRecordResponse> {
    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
    };

    if (opts?.reply) record.reply = opts.reply;
    if (opts?.embed) record.embed = opts.embed;
    if (opts?.facets) record.facets = opts.facets;
    if (opts?.langs) record.langs = opts.langs;

    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.feed.post',
      record,
    });
  }

  async deletePost(uri: string): Promise<void> {
    const rkey = uri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.feed.post',
      rkey,
    });
  }

  // ── Likes ───────────────────────────────────────────

  async like(subject: StrongRef): Promise<CreateRecordResponse> {
    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async unlike(likeUri: string): Promise<void> {
    const rkey = likeUri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.feed.like',
      rkey,
    });
  }

  // ── Reposts ─────────────────────────────────────────

  async repost(subject: StrongRef): Promise<CreateRecordResponse> {
    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.feed.repost',
      record: {
        $type: 'app.bsky.feed.repost',
        subject,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async unrepost(repostUri: string): Promise<void> {
    const rkey = repostUri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.feed.repost',
      rkey,
    });
  }

  // ── Bookmarks ───────────────────────────────────────

  async bookmark(subject: StrongRef): Promise<void> {
    await this.request(
      'POST',
      'app.bsky.bookmark.createBookmark',
      undefined,
      { subject }
    );
  }

  async unbookmark(subject: StrongRef): Promise<void> {
    await this.request(
      'POST',
      'app.bsky.bookmark.deleteBookmark',
      undefined,
      { subject }
    );
  }

  // ── Follows ─────────────────────────────────────────

  async follow(did: string): Promise<CreateRecordResponse> {
    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.follow',
      record: {
        $type: 'app.bsky.graph.follow',
        subject: did,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async unfollow(followUri: string): Promise<void> {
    const rkey = followUri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.follow',
      rkey,
    });
  }

  // ── Profiles ────────────────────────────────────────

  async getProfile(actor: string): Promise<ProfileViewDetailed> {
    return this.request('GET', 'app.bsky.actor.getProfile', { actor });
  }

  // ── Notifications ───────────────────────────────────

  async listNotifications(
    cursor?: string,
    limit = 50
  ): Promise<NotificationsResponse> {
    return this.request('GET', 'app.bsky.notification.listNotifications', {
      cursor,
      limit,
    });
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    return this.request('GET', 'app.bsky.notification.getUnreadCount');
  }

  async updateNotificationSeen(seenAt: string): Promise<void> {
    await this.request(
      'POST',
      'app.bsky.notification.updateSeen',
      undefined,
      { seenAt }
    );
  }

  // ── Search ──────────────────────────────────────────

  async searchActors(
    q: string,
    cursor?: string,
    limit = 25
  ): Promise<SearchActorsResponse> {
    return this.request('GET', 'app.bsky.actor.searchActors', {
      q,
      cursor,
      limit,
    });
  }

  async searchPosts(
    q: string,
    cursor?: string,
    limit = 25,
    sort = 'latest'
  ): Promise<SearchPostsResponse> {
    return this.request('GET', 'app.bsky.feed.searchPosts', {
      q,
      cursor,
      limit,
      sort,
    });
  }

  // ── Social Graph ─────────────────────────────────────

  async getFollows(
    actor: string,
    cursor?: string,
    limit = 50
  ): Promise<FollowsResponse> {
    return this.request('GET', 'app.bsky.graph.getFollows', {
      actor,
      cursor,
      limit,
    });
  }

  async getFollowers(
    actor: string,
    cursor?: string,
    limit = 50
  ): Promise<FollowersResponse> {
    return this.request('GET', 'app.bsky.graph.getFollowers', {
      actor,
      cursor,
      limit,
    });
  }

  // ── Engagement Lists ────────────────────────────────

  async getLikes(
    uri: string,
    cursor?: string,
    limit = 50
  ): Promise<GetLikesResponse> {
    return this.request('GET', 'app.bsky.feed.getLikes', {
      uri,
      cursor,
      limit,
    });
  }

  async getRepostedBy(
    uri: string,
    cursor?: string,
    limit = 50
  ): Promise<RepostedByResponse> {
    return this.request('GET', 'app.bsky.feed.getRepostedBy', {
      uri,
      cursor,
      limit,
    });
  }

  async getQuotes(
    uri: string,
    cursor?: string,
    limit = 50
  ): Promise<GetQuotesResponse> {
    return this.request('GET', 'app.bsky.feed.getQuotes', {
      uri,
      cursor,
      limit,
    });
  }

  // ── Block / Mute ───────────────────────────────────

  async blockActor(did: string): Promise<CreateRecordResponse> {
    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.block',
      record: {
        $type: 'app.bsky.graph.block',
        subject: did,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async unblock(blockUri: string): Promise<void> {
    const rkey = blockUri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.block',
      rkey,
    });
  }

  async muteActor(did: string): Promise<void> {
    await this.request('POST', 'app.bsky.graph.muteActor', undefined, {
      actor: did,
    });
  }

  async unmuteActor(did: string): Promise<void> {
    await this.request('POST', 'app.bsky.graph.unmuteActor', undefined, {
      actor: did,
    });
  }

  async muteThread(root: string): Promise<void> {
    await this.request('POST', 'app.bsky.graph.muteThread', undefined, {
      root,
    });
  }

  async unmuteThread(root: string): Promise<void> {
    await this.request('POST', 'app.bsky.graph.unmuteThread', undefined, {
      root,
    });
  }

  async getMutes(cursor?: string, limit = 50): Promise<MutesResponse> {
    return this.request('GET', 'app.bsky.graph.getMutes', {
      cursor,
      limit,
    });
  }

  async getBlocks(cursor?: string, limit = 50): Promise<BlocksResponse> {
    return this.request('GET', 'app.bsky.graph.getBlocks', {
      cursor,
      limit,
    });
  }

  // ── Reporting ───────────────────────────────────────

  async reportAccount(did: string, reasonType: string, reason?: string): Promise<void> {
    await this.request('POST', 'com.atproto.moderation.createReport', undefined, {
      reasonType: `com.atproto.moderation.defs#${reasonType}`,
      reason,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did,
      },
    });
  }

  async reportPost(uri: string, cid: string, reasonType: string, reason?: string): Promise<void> {
    await this.request('POST', 'com.atproto.moderation.createReport', undefined, {
      reasonType: `com.atproto.moderation.defs#${reasonType}`,
      reason,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri,
        cid,
      },
    });
  }

  // ── Video Upload ────────────────────────────────────

  async getVideoUploadLimits(): Promise<VideoUploadLimits> {
    return this.request('GET', 'app.bsky.video.getUploadLimits');
  }

  async uploadVideo(file: File): Promise<{ jobId: string }> {
    const buffer = await file.arrayBuffer();
    return this.request(
      'POST',
      'app.bsky.video.uploadVideo',
      undefined,
      undefined,
      {
        rawBody: buffer,
        contentType: file.type || 'video/mp4',
        proxy: `did:web:video.bsky.app#bsky_fg`,
      }
    );
  }

  async getVideoJobStatus(jobId: string): Promise<{ jobStatus: VideoJobStatus }> {
    return this.request(
      'GET',
      'app.bsky.video.getJobStatus',
      { jobId },
      undefined,
      { proxy: `did:web:video.bsky.app#bsky_fg` }
    );
  }

  // ── Media Upload ────────────────────────────────────

  async uploadBlob(
    file: File | Blob
  ): Promise<UploadBlobResponse> {
    const buffer = await file.arrayBuffer();
    const mimeType = file instanceof File ? file.type : 'application/octet-stream';

    return this.request(
      'POST',
      'com.atproto.repo.uploadBlob',
      undefined,
      undefined,
      { rawBody: buffer, contentType: mimeType }
    );
  }

  // ── Rich Text Helpers ───────────────────────────────

  detectFacets(text: string): Facet[] {
    const facets: Facet[] = [];
    const encoder = new TextEncoder();

    // Detect URLs
    const urlRegex = /https?:\/\/[^\s)<>]+/g;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(text)) !== null) {
      const beforeBytes = encoder.encode(text.slice(0, match.index)).length;
      const matchBytes = encoder.encode(match[0]).length;
      facets.push({
        index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
        features: [
          { $type: 'app.bsky.richtext.facet#link', uri: match[0] },
        ],
      });
    }

    // Detect mentions (@handle.bsky.social)
    const mentionRegex = /(?<=^|\s)@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g;
    while ((match = mentionRegex.exec(text)) !== null) {
      const beforeBytes = encoder.encode(text.slice(0, match.index)).length;
      const matchBytes = encoder.encode(match[0]).length;
      facets.push({
        index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: '', // Will be resolved before posting
          },
        ],
      });
    }

    // Detect hashtags
    const tagRegex = /(?<=^|\s)#([a-zA-Z0-9_]+)/g;
    while ((match = tagRegex.exec(text)) !== null) {
      const beforeBytes = encoder.encode(text.slice(0, match.index)).length;
      const matchBytes = encoder.encode(match[0]).length;
      facets.push({
        index: { byteStart: beforeBytes, byteEnd: beforeBytes + matchBytes },
        features: [
          { $type: 'app.bsky.richtext.facet#tag', tag: match[1] },
        ],
      });
    }

    return facets;
  }

  async resolveMentions(facets: Facet[]): Promise<Facet[]> {
    const resolved = [...facets];

    for (const facet of resolved) {
      for (const feature of facet.features) {
        if (
          feature.$type === 'app.bsky.richtext.facet#mention' &&
          !feature.did
        ) {
          try {
            const res = await this.request<{ did: string }>(
              'GET',
              'com.atproto.identity.resolveHandle',
              { handle: (feature as { did: string; handle?: string }).did || '' },
              undefined,
              { noAuth: true }
            );
            feature.did = res.did;
          } catch {
            // Remove failed mention facets
          }
        }
      }
    }

    return resolved;
  }

  // ── Direct Messages (Phase 3) ────────────────────────

  async listConvos(cursor?: string, limit = 25): Promise<ListConvosResponse> {
    return this.request('GET', 'chat.bsky.convo.listConvos', {
      cursor,
      limit,
    }, undefined, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async getConvo(convoId: string): Promise<GetConvoResponse> {
    return this.request('GET', 'chat.bsky.convo.getConvo', {
      convoId,
    }, undefined, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async getConvoForMembers(members: string[]): Promise<GetConvoResponse> {
    return this.request('GET', 'chat.bsky.convo.getConvoForMembers', {
      members,
    }, undefined, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async getMessages(
    convoId: string,
    cursor?: string,
    limit = 50
  ): Promise<GetMessagesResponse> {
    return this.request('GET', 'chat.bsky.convo.getMessages', {
      convoId,
      cursor,
      limit,
    }, undefined, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async sendMessage(convoId: string, text: string): Promise<ChatMessageView> {
    const facets = this.detectFacets(text);
    return this.request('POST', 'chat.bsky.convo.sendMessage', undefined, {
      convoId,
      message: {
        $type: 'chat.bsky.convo.defs#messageInput',
        text,
        facets: facets.length > 0 ? facets : undefined,
      },
    }, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async deleteMessage(convoId: string, messageId: string): Promise<void> {
    await this.request('POST', 'chat.bsky.convo.deleteMessageForSelf', undefined, {
      convoId,
      messageId,
    }, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async muteConvo(convoId: string): Promise<GetConvoResponse> {
    return this.request('POST', 'chat.bsky.convo.muteConvo', undefined, {
      convoId,
    }, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async unmuteConvo(convoId: string): Promise<GetConvoResponse> {
    return this.request('POST', 'chat.bsky.convo.unmuteConvo', undefined, {
      convoId,
    }, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  async updateConvoRead(convoId: string): Promise<GetConvoResponse> {
    return this.request('POST', 'chat.bsky.convo.updateRead', undefined, {
      convoId,
    }, { proxy: 'did:web:api.bsky.chat#bsky_chat' });
  }

  // ── Custom Feeds (Phase 3) ──────────────────────────

  async getFeed(
    feed: string,
    cursor?: string,
    limit = 30
  ): Promise<GetFeedResponse> {
    return this.request('GET', 'app.bsky.feed.getFeed', {
      feed,
      cursor,
      limit,
    });
  }

  async getFeedGenerator(feed: string): Promise<{ view: GeneratorView }> {
    return this.request('GET', 'app.bsky.feed.getFeedGenerator', { feed });
  }

  async getFeedGenerators(feeds: string[]): Promise<GetFeedGeneratorsResponse> {
    return this.request('GET', 'app.bsky.feed.getFeedGenerators', { feeds });
  }

  async getSuggestedFeeds(cursor?: string, limit = 50): Promise<GetSuggestedFeedsResponse> {
    return this.request('GET', 'app.bsky.feed.getSuggestedFeeds', {
      cursor,
      limit,
    });
  }

  async getPopularFeedGenerators(
    query?: string,
    cursor?: string,
    limit = 25
  ): Promise<GetSuggestedFeedsResponse> {
    return this.request('GET', 'app.bsky.unspecced.getPopularFeedGenerators', {
      query,
      cursor,
      limit,
    });
  }

  async getPreferences(): Promise<GetPreferencesResponse> {
    return this.request('GET', 'app.bsky.actor.getPreferences');
  }

  async likeFeed(uri: string, cid: string): Promise<CreateRecordResponse> {
    return this.like({ uri, cid });
  }

  async unlikeFeed(likeUri: string): Promise<void> {
    return this.unlike(likeUri);
  }

  // ── Lists (Phase 3) ────────────────────────────────

  async getList(
    list: string,
    cursor?: string,
    limit = 50
  ): Promise<GetListResponse> {
    return this.request('GET', 'app.bsky.graph.getList', {
      list,
      cursor,
      limit,
    });
  }

  async getLists(
    actor: string,
    cursor?: string,
    limit = 50
  ): Promise<GetListsResponse> {
    return this.request('GET', 'app.bsky.graph.getLists', {
      actor,
      cursor,
      limit,
    });
  }

  async getListFeed(
    list: string,
    cursor?: string,
    limit = 30
  ): Promise<GetListFeedResponse> {
    return this.request('GET', 'app.bsky.feed.getListFeed', {
      list,
      cursor,
      limit,
    });
  }

  async createList(
    name: string,
    purpose: string,
    description?: string
  ): Promise<CreateRecordResponse> {
    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.list',
      record: {
        $type: 'app.bsky.graph.list',
        name,
        purpose,
        description,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async deleteList(listUri: string): Promise<void> {
    const rkey = listUri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.list',
      rkey,
    });
  }

  async addToList(listUri: string, subject: string): Promise<CreateRecordResponse> {
    return this.request('POST', 'com.atproto.repo.createRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.listitem',
      record: {
        $type: 'app.bsky.graph.listitem',
        subject,
        list: listUri,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async removeFromList(itemUri: string): Promise<void> {
    const rkey = itemUri.split('/').pop()!;
    await this.request('POST', 'com.atproto.repo.deleteRecord', undefined, {
      repo: this.session!.did,
      collection: 'app.bsky.graph.listitem',
      rkey,
    });
  }

  // ── Bookmarks (Phase 3) ────────────────────────────

  async getBookmarks(cursor?: string, limit = 25): Promise<GetBookmarksResponse> {
    return this.request('GET', 'app.bsky.feed.getActorBookmarks' as string, {
      cursor,
      limit,
    });
  }

  // ── Typeahead (Phase 3) ────────────────────────────

  async searchActorsTypeahead(q: string, limit = 8): Promise<TypeaheadResponse> {
    return this.request('GET', 'app.bsky.actor.searchActorsTypeahead', {
      q,
      limit,
    });
  }
}

// ── Error Class ─────────────────────────────────────────

export class APIError extends Error {
  status: number;
  error: string;

  constructor(status: number, error: string, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.error = error;
  }
}

// ── Singleton Export ────────────────────────────────────

export const api = new BlueskyAPI();
export default api;
