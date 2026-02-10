/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Likes / Reposts / Quotes Modal
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonTitle,
  IonContent,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { api } from '../services/api';
import type { ProfileViewBasic, PostView } from '../types';
import { DEFAULT_AVATAR } from '../utils';
import PostCard from './PostCard';

type EngagementTab = 'likes' | 'reposts' | 'quotes';

interface LikesRepostsModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  postUri: string;
  postCid: string;
  initialTab?: EngagementTab;
  likeCount?: number;
  repostCount?: number;
  quoteCount?: number;
}

export default function LikesRepostsModal({
  isOpen,
  onDismiss,
  postUri,
  postCid,
  initialTab = 'likes',
  likeCount = 0,
  repostCount = 0,
  quoteCount = 0,
}: LikesRepostsModalProps) {
  const history = useHistory();
  const [tab, setTab] = useState<EngagementTab>(initialTab);
  const [users, setUsers] = useState<ProfileViewBasic[]>([]);
  const [quotePosts, setQuotePosts] = useState<PostView[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(
    async (reset = true) => {
      if (!postUri) return;
      setLoading(reset);
      try {
        if (tab === 'likes') {
          const res = await api.getLikes(postUri, reset ? undefined : cursor, 50);
          const actors = res.likes.map((l) => l.actor);
          if (reset) {
            setUsers(actors);
            setQuotePosts([]);
          } else {
            setUsers((prev) => [...prev, ...actors]);
          }
          setCursor(res.cursor);
        } else if (tab === 'reposts') {
          const res = await api.getRepostedBy(postUri, reset ? undefined : cursor, 50);
          if (reset) {
            setUsers(res.repostedBy);
            setQuotePosts([]);
          } else {
            setUsers((prev) => [...prev, ...res.repostedBy]);
          }
          setCursor(res.cursor);
        } else if (tab === 'quotes') {
          const res = await api.getQuotes(postUri, reset ? undefined : cursor, 50);
          if (reset) {
            setQuotePosts(res.posts);
            setUsers([]);
          } else {
            setQuotePosts((prev) => [...prev, ...res.posts]);
          }
          setCursor(res.cursor);
        }
      } catch (err) {
        console.error('Failed to load engagement data:', err);
      } finally {
        setLoading(false);
      }
    },
    [postUri, tab, cursor]
  );

  useEffect(() => {
    if (isOpen) {
      setUsers([]);
      setQuotePosts([]);
      setCursor(undefined);
      loadData(true);
    }
  }, [isOpen, tab]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadData(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, loadData]
  );

  const navigateToProfile = useCallback(
    (did: string) => {
      onDismiss();
      setTimeout(() => history.push(`/profile/${did}`), 200);
    },
    [history, onDismiss]
  );

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}>
            Engagement
          </IonTitle>
        </IonToolbar>
        <IonToolbar style={{ '--min-height': '44px' }}>
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab(e.detail.value as EngagementTab)}
          >
            {likeCount > 0 && (
              <IonSegmentButton value="likes">
                <IonLabel>Likes ({likeCount > 999 ? '999+' : likeCount})</IonLabel>
              </IonSegmentButton>
            )}
            {repostCount > 0 && (
              <IonSegmentButton value="reposts">
                <IonLabel>Reposts ({repostCount > 999 ? '999+' : repostCount})</IonLabel>
              </IonSegmentButton>
            )}
            {quoteCount > 0 && (
              <IonSegmentButton value="quotes">
                <IonLabel>Quotes ({quoteCount > 999 ? '999+' : quoteCount})</IonLabel>
              </IonSegmentButton>
            )}
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : tab === 'quotes' ? (
          quotePosts.length === 0 ? (
            <div className="empty-state">
              <h3>No quotes yet</h3>
            </div>
          ) : (
            quotePosts.map((post, i) => (
              <PostCard key={`${post.uri}-${i}`} post={post} />
            ))
          )
        ) : users.length === 0 ? (
          <div className="empty-state">
            <h3>No {tab} yet</h3>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.did}
              className="search-user-item"
              onClick={() => navigateToProfile(user.did)}
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
              {user.viewer?.following && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--hb-accent)',
                    fontWeight: 600,
                  }}
                >
                  Following
                </span>
              )}
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
    </IonModal>
  );
}
