/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Follows / Followers List Page
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
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import type { ProfileViewBasic } from '../types';
import { DEFAULT_AVATAR } from '../utils';

type ListType = 'followers' | 'following';

export default function FollowsListPage() {
  const { actor } = useParams<{ actor: string }>();
  const history = useHistory();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const initialTab = (params.get('tab') as ListType) || 'followers';

  const [tab, setTab] = useState<ListType>(initialTab);
  const [users, setUsers] = useState<ProfileViewBasic[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, { following: boolean; uri: string }>>({});

  const loadList = useCallback(
    async (reset = true) => {
      if (!actor) return;
      setLoading(reset);
      try {
        if (tab === 'followers') {
          const res = await api.getFollowers(actor, reset ? undefined : cursor, 50);
          const list = res.followers;
          if (reset) {
            setUsers(list);
          } else {
            setUsers((prev) => [...prev, ...list]);
          }
          setCursor(res.cursor);

          // Track follow states
          const states: Record<string, { following: boolean; uri: string }> = {};
          list.forEach((u) => {
            states[u.did] = {
              following: !!u.viewer?.following,
              uri: u.viewer?.following || '',
            };
          });
          setFollowStates((prev) => (reset ? states : { ...prev, ...states }));
        } else {
          const res = await api.getFollows(actor, reset ? undefined : cursor, 50);
          const list = res.follows;
          if (reset) {
            setUsers(list);
          } else {
            setUsers((prev) => [...prev, ...list]);
          }
          setCursor(res.cursor);

          const states: Record<string, { following: boolean; uri: string }> = {};
          list.forEach((u) => {
            states[u.did] = {
              following: !!u.viewer?.following,
              uri: u.viewer?.following || '',
            };
          });
          setFollowStates((prev) => (reset ? states : { ...prev, ...states }));
        }
      } catch (err) {
        console.error('Failed to load list:', err);
      } finally {
        setLoading(false);
      }
    },
    [actor, tab, cursor]
  );

  useEffect(() => {
    setUsers([]);
    setCursor(undefined);
    loadList(true);
  }, [actor, tab]);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadList(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadList]
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

  const handleFollow = useCallback(async (did: string) => {
    const state = followStates[did];
    if (!state) return;

    if (state.following) {
      setFollowStates((prev) => ({
        ...prev,
        [did]: { following: false, uri: '' },
      }));
      try {
        await api.unfollow(state.uri);
      } catch {
        setFollowStates((prev) => ({
          ...prev,
          [did]: { following: true, uri: state.uri },
        }));
      }
    } else {
      setFollowStates((prev) => ({
        ...prev,
        [did]: { following: true, uri: '' },
      }));
      try {
        const res = await api.follow(did);
        setFollowStates((prev) => ({
          ...prev,
          [did]: { following: true, uri: res.uri },
        }));
      } catch {
        setFollowStates((prev) => ({
          ...prev,
          [did]: { following: false, uri: '' },
        }));
      }
    }
  }, [followStates]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/profile/${actor}`} />
          </IonButtons>
          <IonTitle style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}>
            {tab === 'followers' ? 'Followers' : 'Following'}
          </IonTitle>
        </IonToolbar>
        <IonToolbar style={{ '--min-height': '44px' }}>
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab(e.detail.value as ListType)}
          >
            <IonSegmentButton value="followers">
              <IonLabel>Followers</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="following">
              <IonLabel>Following</IonLabel>
            </IonSegmentButton>
          </IonSegment>
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
        ) : users.length === 0 ? (
          <div className="empty-state">
            <h3>
              {tab === 'followers' ? 'No followers yet' : 'Not following anyone'}
            </h3>
          </div>
        ) : (
          users.map((user) => {
            const myDid = api.getDid();
            const isMe = user.did === myDid;
            const state = followStates[user.did];

            return (
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
                  {user.viewer?.followedBy && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--hb-text-muted)',
                        background: 'var(--hb-surface-raised)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginTop: 2,
                        display: 'inline-block',
                      }}
                    >
                      Follows you
                    </span>
                  )}
                </div>
                {!isMe && state && (
                  <IonButton
                    fill={state.following ? 'outline' : 'solid'}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollow(user.did);
                    }}
                    style={{
                      '--border-radius': '20px',
                      fontSize: 12,
                      fontWeight: 700,
                      minHeight: 30,
                    }}
                  >
                    {state.following ? 'Following' : 'Follow'}
                  </IonButton>
                )}
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
