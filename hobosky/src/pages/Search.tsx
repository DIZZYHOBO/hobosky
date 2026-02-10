/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Search Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useCallback, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonIcon,
} from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';
import { searchOutline } from 'ionicons/icons';
import { api } from '../services/api';
import type { ProfileViewBasic, PostView } from '../types';
import PostCard from '../components/PostCard';
import { DEFAULT_AVATAR } from '../utils';

type SearchTab = 'people' | 'posts';

export default function SearchPage() {
  const history = useHistory();
  const location = useLocation();

  // Parse initial query from URL
  const urlParams = new URLSearchParams(location.search);
  const initialQuery = urlParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTab>('people');
  const [searching, setSearching] = useState(false);

  const [actors, setActors] = useState<ProfileViewBasic[]>([]);
  const [actorCursor, setActorCursor] = useState<string | undefined>();

  const [posts, setPosts] = useState<PostView[]>([]);
  const [postCursor, setPostCursor] = useState<string | undefined>();

  const doSearch = useCallback(
    async (q: string, reset = true) => {
      if (!q.trim()) {
        setActors([]);
        setPosts([]);
        return;
      }

      setSearching(true);
      try {
        if (tab === 'people') {
          const res = await api.searchActors(
            q,
            reset ? undefined : actorCursor,
            25
          );
          if (reset) {
            setActors(res.actors);
          } else {
            setActors((prev) => [...prev, ...res.actors]);
          }
          setActorCursor(res.cursor);
        } else {
          const res = await api.searchPosts(
            q,
            reset ? undefined : postCursor,
            25
          );
          if (reset) {
            setPosts(res.posts);
          } else {
            setPosts((prev) => [...prev, ...res.posts]);
          }
          setPostCursor(res.cursor);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    },
    [tab, actorCursor, postCursor]
  );

  // Search when tab changes with existing query
  useEffect(() => {
    if (query.trim()) {
      doSearch(query, true);
    }
  }, [tab]);

  // Search from URL param on mount
  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery, true);
    }
  }, []);

  const handleSearch = useCallback(
    (e: CustomEvent) => {
      const q = (e.detail.value || '').trim();
      setQuery(q);
      if (q) {
        doSearch(q, true);
      } else {
        setActors([]);
        setPosts([]);
      }
    },
    [doSearch]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      const hasMore = tab === 'people' ? !!actorCursor : !!postCursor;
      if (!hasMore) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await doSearch(query, false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [tab, actorCursor, postCursor, query, doSearch]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonSearchbar
            value={query}
            onIonChange={handleSearch}
            placeholder="Search Bluesky..."
            debounce={400}
            animated
            style={{ padding: '8px 12px' }}
          />
        </IonToolbar>
        <IonToolbar style={{ '--min-height': '44px' }}>
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab(e.detail.value as SearchTab)}
          >
            <IonSegmentButton value="people">
              <IonLabel>People</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="posts">
              <IonLabel>Posts</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {!query.trim() ? (
          <div className="empty-state">
            <IonIcon icon={searchOutline} />
            <h3>Search Bluesky</h3>
            <p>Find people and posts across the network.</p>
          </div>
        ) : searching && (tab === 'people' ? actors.length === 0 : posts.length === 0) ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : tab === 'people' ? (
          actors.length === 0 ? (
            <div className="empty-state">
              <h3>No people found</h3>
              <p>Try a different search term.</p>
            </div>
          ) : (
            actors.map((actor) => (
              <div
                key={actor.did}
                className="search-user-item"
                onClick={() => history.push(`/profile/${actor.did}`)}
              >
                <img
                  className="post-avatar"
                  src={actor.avatar || DEFAULT_AVATAR}
                  alt=""
                />
                <div className="search-user-info">
                  <div className="search-user-name">
                    {actor.displayName || actor.handle}
                  </div>
                  <div className="search-user-handle">@{actor.handle}</div>
                </div>
                {actor.viewer?.following ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--hb-accent)',
                      fontWeight: 600,
                    }}
                  >
                    Following
                  </span>
                ) : null}
              </div>
            ))
          )
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <h3>No posts found</h3>
            <p>Try a different search term.</p>
          </div>
        ) : (
          posts.map((post, i) => (
            <PostCard key={`${post.uri}-${i}`} post={post} />
          ))
        )}

        <IonInfiniteScroll
          threshold="200px"
          onIonInfinite={handleInfiniteScroll}
          disabled={
            tab === 'people' ? !actorCursor : !postCursor
          }
        >
          <IonInfiniteScrollContent loadingSpinner="crescent" />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
}
