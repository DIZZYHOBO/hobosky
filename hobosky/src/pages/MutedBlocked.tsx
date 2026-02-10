/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Muted & Blocked Users Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonIcon,
  useIonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { volumeMuteOutline, banOutline } from 'ionicons/icons';
import { api } from '../services/api';
import type { ProfileViewBasic } from '../types';
import { DEFAULT_AVATAR } from '../utils';

type MBTab = 'muted' | 'blocked';

export default function MutedBlockedPage() {
  const history = useHistory();
  const [present] = useIonToast();
  const [tab, setTab] = useState<MBTab>('muted');
  const [users, setUsers] = useState<ProfileViewBasic[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(
    async (reset = true) => {
      setLoading(reset);
      try {
        if (tab === 'muted') {
          const res = await api.getMutes(reset ? undefined : cursor, 50);
          if (reset) {
            setUsers(res.mutes);
          } else {
            setUsers((prev) => [...prev, ...res.mutes]);
          }
          setCursor(res.cursor);
        } else {
          const res = await api.getBlocks(reset ? undefined : cursor, 50);
          if (reset) {
            setUsers(res.blocks);
          } else {
            setUsers((prev) => [...prev, ...res.blocks]);
          }
          setCursor(res.cursor);
        }
      } catch (err) {
        console.error('Failed to load list:', err);
      } finally {
        setLoading(false);
      }
    },
    [tab, cursor]
  );

  useEffect(() => {
    setUsers([]);
    setCursor(undefined);
    loadList(true);
  }, [tab]);

  const handleUnmute = useCallback(
    async (did: string, handle: string) => {
      try {
        await api.unmuteActor(did);
        setUsers((prev) => prev.filter((u) => u.did !== did));
        present({
          message: `Unmuted @${handle}`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      } catch (err) {
        present({
          message: `Failed: ${(err as Error).message}`,
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
      }
    },
    [present]
  );

  const handleUnblock = useCallback(
    async (did: string, handle: string, blockUri: string) => {
      try {
        await api.unblock(blockUri);
        setUsers((prev) => prev.filter((u) => u.did !== did));
        present({
          message: `Unblocked @${handle}`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      } catch (err) {
        present({
          message: `Failed: ${(err as Error).message}`,
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
      }
    },
    [present]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadList(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, loadList]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/profile" />
          </IonButtons>
          <IonTitle style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}>
            Moderation
          </IonTitle>
        </IonToolbar>
        <IonToolbar style={{ '--min-height': '44px' }}>
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab(e.detail.value as MBTab)}
          >
            <IonSegmentButton value="muted">
              <IonLabel>Muted</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="blocked">
              <IonLabel>Blocked</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={tab === 'muted' ? volumeMuteOutline : banOutline} />
            <h3>
              {tab === 'muted'
                ? 'No muted accounts'
                : 'No blocked accounts'}
            </h3>
            <p>
              {tab === 'muted'
                ? "Accounts you mute won't appear in your feeds."
                : "Accounts you block can't see your content or interact with you."}
            </p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.did}
              className="search-user-item"
              onClick={() => history.push(`/profile/${user.did}`)}
            >
              <img
                className="post-avatar"
                src={user.avatar || DEFAULT_AVATAR}
                alt=""
              />
              <div className="search-user-info">
                <div className="search-user-name">
                  {user.displayName || user.handle}
                </div>
                <div className="search-user-handle">@{user.handle}</div>
              </div>
              <IonButton
                fill="outline"
                color="medium"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tab === 'muted') {
                    handleUnmute(user.did, user.handle);
                  } else {
                    const blockUri = user.viewer?.blocking || '';
                    handleUnblock(user.did, user.handle, blockUri);
                  }
                }}
                style={{
                  '--border-radius': '20px',
                  fontSize: 12,
                  fontWeight: 600,
                  minHeight: 30,
                }}
              >
                {tab === 'muted' ? 'Unmute' : 'Unblock'}
              </IonButton>
            </div>
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
