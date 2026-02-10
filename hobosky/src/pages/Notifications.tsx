/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Notifications Page
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
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  heartOutline,
  repeatOutline,
  personAddOutline,
  chatbubbleOutline,
  atOutline,
  chatbubblesOutline,
} from 'ionicons/icons';
import { api } from '../services/api';
import type { Notification } from '../types';
import { timeAgo, DEFAULT_AVATAR } from '../utils';

const REASON_CONFIG: Record<
  string,
  { icon: string; label: string; className: string }
> = {
  like: { icon: heartOutline, label: 'liked your post', className: 'like' },
  repost: { icon: repeatOutline, label: 'reposted your post', className: 'repost' },
  follow: { icon: personAddOutline, label: 'followed you', className: 'follow' },
  mention: { icon: atOutline, label: 'mentioned you', className: 'mention' },
  reply: { icon: chatbubbleOutline, label: 'replied to you', className: 'reply' },
  quote: { icon: chatbubblesOutline, label: 'quoted your post', className: 'quote' },
};

export default function NotificationsPage() {
  const history = useHistory();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      const res = await api.listNotifications(isRefresh ? undefined : undefined, 50);
      setNotifications(res.notifications || []);
      setCursor(res.cursor);

      // Mark as seen
      await api.updateNotificationSeen(new Date().toISOString()).catch(() => {});
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadNotifications();
    }
  }, [loadNotifications]);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadNotifications(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadNotifications]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      try {
        const res = await api.listNotifications(cursor, 50);
        setNotifications((prev) => [...prev, ...(res.notifications || [])]);
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load more:', err);
      }
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor]
  );

  const handleNotifClick = useCallback(
    (notif: Notification) => {
      if (notif.reason === 'follow') {
        history.push(`/profile/${notif.author.did}`);
      } else if (notif.reasonSubject) {
        history.push(`/thread/${encodeURIComponent(notif.reasonSubject)}`);
      } else if (notif.uri) {
        history.push(`/thread/${encodeURIComponent(notif.uri)}`);
      }
    },
    [history]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}>
            Notifications
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
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={chatbubbleOutline} />
            <h3>No notifications yet</h3>
            <p>When someone interacts with your posts, you'll see it here.</p>
          </div>
        ) : (
          notifications.map((notif, i) => {
            const config = REASON_CONFIG[notif.reason] || {
              icon: chatbubbleOutline,
              label: notif.reason,
              className: 'reply',
            };

            const subjectText =
              notif.reason === 'reply' || notif.reason === 'mention' || notif.reason === 'quote'
                ? (notif.record as { text?: string })?.text
                : undefined;

            return (
              <div
                key={`${notif.uri}-${i}`}
                className={`notif-item ${notif.isRead ? '' : 'unread'}`}
                onClick={() => handleNotifClick(notif)}
              >
                <div className={`notif-icon ${config.className}`}>
                  <IonIcon icon={config.icon} style={{ fontSize: 18 }} />
                </div>
                <div className="notif-body">
                  <div style={{ marginBottom: 4 }}>
                    <img
                      src={notif.author.avatar || DEFAULT_AVATAR}
                      alt=""
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        verticalAlign: 'middle',
                        marginRight: 8,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        history.push(`/profile/${notif.author.did}`);
                      }}
                    />
                  </div>
                  <div className="notif-text">
                    <strong>
                      {notif.author.displayName || notif.author.handle}
                    </strong>{' '}
                    {config.label}
                  </div>
                  {subjectText && (
                    <div className="notif-subject">{subjectText}</div>
                  )}
                  <div className="notif-time">{timeAgo(notif.indexedAt)}</div>
                </div>
              </div>
            );
          })
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
