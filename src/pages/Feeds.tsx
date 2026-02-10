/* ──────────────────────────────────────────────────────────
   HoboSky v0.3.0 — Feeds Browser Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonButton,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  useIonToast,
} from '@ionic/react';
import {
  heartOutline,
  heart,
  searchOutline,
} from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { GeneratorView, FeedViewPost } from '../types';
import PostCard from '../components/PostCard';
import { formatCount, DEFAULT_AVATAR } from '../utils';

type FeedsTab = 'discover' | 'saved';

/* ── Feeds Browser (main page) ────────────────────────── */

export default function FeedsPage() {
  const history = useHistory();
  const [present] = useIonToast();
  const [tab, setTab] = useState<FeedsTab>('discover');
  const [feeds, setFeeds] = useState<GeneratorView[]>([]);
  const [savedFeeds, setSavedFeeds] = useState<GeneratorView[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDiscover = useCallback(
    async (reset = true, query?: string) => {
      setLoading(reset);
      try {
        const res = await api.getPopularFeedGenerators(
          query || undefined,
          reset ? undefined : cursor,
          25
        );
        if (reset) {
          setFeeds(res.feeds);
        } else {
          setFeeds((prev) => [...prev, ...res.feeds]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load feeds:', err);
      } finally {
        setLoading(false);
      }
    },
    [cursor]
  );

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await api.getPreferences();
      const savedPref = prefs.preferences.find(
        (p: Record<string, unknown>) =>
          p.$type === 'app.bsky.actor.defs#savedFeedsPrefV2'
      ) as { items?: Array<{ type: string; value: string }> } | undefined;

      if (savedPref?.items) {
        const feedUris = savedPref.items
          .filter((item) => item.type === 'feed')
          .map((item) => item.value);

        if (feedUris.length > 0) {
          const res = await api.getFeedGenerators(feedUris);
          setSavedFeeds(res.feeds);
        } else {
          setSavedFeeds([]);
        }
      } else {
        setSavedFeeds([]);
      }
    } catch (err) {
      console.error('Failed to load saved feeds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'discover') {
      setFeeds([]);
      setCursor(undefined);
      loadDiscover(true, searchQuery);
    } else {
      loadSaved();
    }
  }, [tab]);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFeeds([]);
        setCursor(undefined);
        loadDiscover(true, q);
      }, 400);
    },
    [loadDiscover]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor || tab !== 'discover') {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadDiscover(false, searchQuery);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, tab, loadDiscover, searchQuery]
  );

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      if (tab === 'discover') {
        await loadDiscover(true, searchQuery);
      } else {
        await loadSaved();
      }
      (event.target as HTMLIonRefresherElement).complete();
    },
    [tab, loadDiscover, loadSaved, searchQuery]
  );

  const displayFeeds = tab === 'discover' ? feeds : savedFeeds;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}
          >
            Feeds
          </IonTitle>
        </IonToolbar>
        <IonToolbar style={{ '--min-height': '44px' }}>
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab(e.detail.value as FeedsTab)}
          >
            <IonSegmentButton value="discover">
              <IonLabel>Discover</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="saved">
              <IonLabel>My Feeds</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Search bar (discover only) */}
        {tab === 'discover' && (
          <div style={{ padding: '12px 16px 4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 12,
                background: 'var(--hb-surface-raised)',
                border: '1px solid var(--hb-border)',
              }}
            >
              <IonIcon
                icon={searchOutline}
                style={{
                  fontSize: 18,
                  color: 'var(--hb-text-muted)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search feeds..."
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--hb-text-primary)',
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : displayFeeds.length === 0 ? (
          <div className="empty-state">
            <h3>
              {tab === 'discover'
                ? 'No feeds found'
                : 'No saved feeds'}
            </h3>
            {tab === 'saved' && (
              <p>Discover and like feeds to save them here</p>
            )}
          </div>
        ) : (
          displayFeeds.map((feed) => (
            <div
              key={feed.uri}
              className="search-user-item"
              onClick={() =>
                history.push(
                  `/feeds/${encodeURIComponent(feed.uri)}`
                )
              }
            >
              <img
                className="post-avatar"
                src={feed.avatar || DEFAULT_AVATAR}
                alt=""
                style={{ borderRadius: 8 }}
              />
              <div className="search-user-info">
                <div className="search-user-name">
                  {feed.displayName}
                </div>
                <div className="search-user-handle">
                  by @{feed.creator.handle}
                </div>
                {feed.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--hb-text-muted)',
                      marginTop: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {feed.description}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--hb-text-muted)',
                  flexShrink: 0,
                }}
              >
                <IonIcon
                  icon={feed.viewer?.like ? heart : heartOutline}
                  style={{
                    color: feed.viewer?.like
                      ? 'var(--hb-like)'
                      : undefined,
                  }}
                />
                {formatCount(feed.likeCount)}
              </div>
            </div>
          ))
        )}

        <IonInfiniteScroll
          threshold="200px"
          onIonInfinite={handleInfiniteScroll}
          disabled={!cursor || tab !== 'discover'}
        >
          <IonInfiniteScrollContent loadingSpinner="crescent" />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
}

/* ── Feed Detail View ─────────────────────────────────── */

export function FeedDetailPage() {
  const { uri } = useParams<{ uri: string }>();
  const decodedUri = decodeURIComponent(uri);
  const [present] = useIonToast();

  const [info, setInfo] = useState<GeneratorView | null>(null);
  const [feed, setFeed] = useState<FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeUri, setLikeUri] = useState('');
  const [likeCount, setLikeCount] = useState(0);

  const loadFeed = useCallback(
    async (reset = true) => {
      setFeedLoading(true);
      try {
        const res = await api.getFeed(
          decodedUri,
          reset ? undefined : cursor,
          30
        );
        if (reset) {
          setFeed(res.feed);
        } else {
          setFeed((prev) => [...prev, ...res.feed]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load feed:', err);
      } finally {
        setFeedLoading(false);
      }
    },
    [decodedUri, cursor]
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const res = await api.getFeedGenerator(decodedUri);
        setInfo(res.view);
        setLiked(!!res.view.viewer?.like);
        setLikeUri(res.view.viewer?.like || '');
        setLikeCount(res.view.likeCount ?? 0);
      } catch (err) {
        console.error('Failed to load feed info:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
    loadFeed(true);
  }, [decodedUri]);

  const handleLike = useCallback(async () => {
    if (!info) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      try {
        await api.unlikeFeed(likeUri);
        setLikeUri('');
      } catch {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      try {
        const res = await api.likeFeed(info.uri, info.cid);
        setLikeUri(res.uri);
      } catch {
        setLiked(false);
        setLikeCount((c) => c - 1);
      }
    }
  }, [liked, likeUri, info]);

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadFeed(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, loadFeed]
  );

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadFeed(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadFeed]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/feeds" />
          </IonButtons>
          <IonTitle
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}
          >
            {info?.displayName || 'Feed'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : info ? (
          <>
            {/* Feed Info Header */}
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid var(--hb-border)',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <img
                src={info.avatar || DEFAULT_AVATAR}
                alt=""
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  objectFit: 'cover',
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    fontFamily: 'Outfit',
                    color: 'var(--hb-text-primary)',
                  }}
                >
                  {info.displayName}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--hb-text-muted)',
                    marginTop: 2,
                  }}
                >
                  by @{info.creator.handle}
                </div>
                {info.description && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--hb-text-secondary)',
                      marginTop: 6,
                      lineHeight: 1.45,
                    }}
                  >
                    {info.description}
                  </div>
                )}
                <IonButton
                  fill={liked ? 'outline' : 'solid'}
                  size="small"
                  onClick={handleLike}
                  style={{
                    '--border-radius': '20px',
                    fontSize: 12,
                    fontWeight: 700,
                    minHeight: 30,
                    marginTop: 10,
                  }}
                >
                  <IonIcon
                    icon={liked ? heart : heartOutline}
                    slot="start"
                    style={{ fontSize: 16 }}
                  />
                  {liked ? 'Liked' : 'Like'} ({formatCount(likeCount)})
                </IonButton>
              </div>
            </div>

            {/* Feed Posts */}
            {feedLoading && feed.length === 0 ? (
              <div className="loading-center">
                <IonSpinner name="crescent" />
              </div>
            ) : feed.length === 0 ? (
              <div className="empty-state">
                <h3>No posts in this feed</h3>
              </div>
            ) : (
              feed.map((item, i) => (
                <PostCard
                  key={`${item.post.uri}-${i}`}
                  feedItem={item}
                />
              ))
            )}

            <IonInfiniteScroll
              threshold="200px"
              onIonInfinite={handleInfiniteScroll}
              disabled={!cursor}
            >
              <IonInfiniteScrollContent loadingSpinner="crescent" />
            </IonInfiniteScroll>
          </>
        ) : (
          <div className="empty-state">
            <h3>Feed not found</h3>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
