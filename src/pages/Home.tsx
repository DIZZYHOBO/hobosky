/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Home / Timeline Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { api } from '../services/api';
import type { FeedViewPost } from '../types';
import PostCard from '../components/PostCard';
import ComposeModal from '../components/ComposeModal';

export default function HomePage() {
  const [feed, setFeed] = useState<FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const hasLoaded = useRef(false);

  const loadTimeline = useCallback(async (isRefresh = false) => {
    try {
      const res = await api.getTimeline(isRefresh ? undefined : undefined, 50);
      setFeed(res.feed);
      setCursor(res.cursor);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadTimeline();
    }
  }, [loadTimeline]);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadTimeline(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadTimeline]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      try {
        const res = await api.getTimeline(cursor, 50);
        setFeed((prev) => [...prev, ...res.feed]);
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load more:', err);
      }
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle
            style={{
              fontFamily: 'Outfit',
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: '-0.02em',
            }}
          >
            HoboSky
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
        ) : feed.length === 0 ? (
          <div className="empty-state">
            <h3>Your timeline is empty</h3>
            <p>Follow some people to see their posts here.</p>
          </div>
        ) : (
          feed.map((item, index) => (
            <PostCard key={`${item.post.uri}-${index}`} feedItem={item} />
          ))
        )}

        <IonInfiniteScroll
          threshold="200px"
          onIonInfinite={handleInfiniteScroll}
          disabled={!cursor}
        >
          <IonInfiniteScrollContent loadingSpinner="crescent" />
        </IonInfiniteScroll>

        <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ bottom: 16, right: 16 }}>
          <IonFabButton
            onClick={() => setComposeOpen(true)}
            style={{
              '--background': 'var(--hb-accent)',
              '--background-hover': 'var(--hb-accent-hover)',
              width: 56,
              height: 56,
            }}
          >
            <IonIcon icon={addOutline} style={{ fontSize: 26 }} />
          </IonFabButton>
        </IonFab>

        <ComposeModal
          isOpen={composeOpen}
          onDismiss={() => setComposeOpen(false)}
          onSuccess={() => loadTimeline(true)}
        />
      </IonContent>
    </IonPage>
  );
}
