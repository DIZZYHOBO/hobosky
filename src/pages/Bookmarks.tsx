/* ──────────────────────────────────────────────────────────
   HoboSky v0.3.0 — Bookmarks Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { bookmarkOutline } from 'ionicons/icons';
import { api } from '../services/api';
import type { FeedViewPost } from '../types';
import PostCard from '../components/PostCard';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const loadBookmarks = useCallback(
    async (reset = true) => {
      setLoading(reset);
      try {
        const res = await api.getBookmarks(
          reset ? undefined : cursor,
          25
        );
        if (reset) {
          setBookmarks(res.bookmarks);
        } else {
          setBookmarks((prev) => [...prev, ...res.bookmarks]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load bookmarks:', err);
        // Bookmarks API might not be available for all users yet
        if (reset) setBookmarks([]);
      } finally {
        setLoading(false);
      }
    },
    [cursor]
  );

  useEffect(() => {
    loadBookmarks(true);
  }, []);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadBookmarks(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadBookmarks]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadBookmarks(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, loadBookmarks]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/profile" />
          </IonButtons>
          <IonTitle
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}
          >
            Bookmarks
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
        ) : bookmarks.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={bookmarkOutline} />
            <h3>No bookmarks yet</h3>
            <p>Bookmark posts to save them for later</p>
          </div>
        ) : (
          bookmarks.map((item, i) => (
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
      </IonContent>
    </IonPage>
  );
}
