/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Bluesky AT Protocol API Service
   ────────────────────────────────────────────────────────── */

import type {
  SessionData,
  ProfileViewDetailed,
  TimelineResponse,
  AuthorFeedResponse,
  ThreadResponse,
  NotificationsResponse,
  SearchActorsResponse,
  SearchPostsResponse,
  UnreadCountResponse,
  UploadBlobResponse,
  CreateRecordResponse,
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
    params?: Record<string, string | number | boolean | undefined>,
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
        if (v !== undefined && v !== null) search.set(k, String(v));
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
