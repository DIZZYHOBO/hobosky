/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Profile Page
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
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  useIonToast,
} from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import {
  logOutOutline,
  ellipsisHorizontal,
  shieldOutline,
  bookmarkOutline,
  listOutline,
  gridOutline,
  chatbubblesOutline,
} from 'ionicons/icons';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ProfileViewDetailed, FeedViewPost } from '../types';
import PostCard from '../components/PostCard';
import UserActionsSheet from '../components/UserActionsSheet';
import { formatCount, DEFAULT_AVATAR } from '../utils';

type FeedFilter =
  | 'posts_with_replies'
  | 'posts_no_replies'
  | 'posts_with_media'
  | 'likes';

export default function ProfilePage() {
  const { actor } = useParams<{ actor: string }>();
  const { session, logout } = useAuth();
  const history = useHistory();
  const [present] = useIonToast();

  const isOwnProfile =
    !actor || actor === session?.did || actor === session?.handle;
  const actorId = actor || session?.did || '';

  const [profile, setProfile] = useState<ProfileViewDetailed | null>(null);
  const [feed, setFeed] = useState<FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(
    'posts_with_replies'
  );

  const [following, setFollowing] = useState(false);
  const [followUri, setFollowUri] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!actorId) return;
    try {
      const p = await api.getProfile(actorId);
      setProfile(p);
      setFollowing(!!p.viewer?.following);
      setFollowUri(p.viewer?.following || '');
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  const loadFeed = useCallback(
    async (reset = false) => {
      if (!actorId) return;
      setFeedLoading(true);
      try {
        let res;
        if (feedFilter === 'likes') {
          res = await api.getActorLikes(
            actorId,
            reset ? undefined : cursor,
            50
          );
        } else {
          res = await api.getAuthorFeed(
            actorId,
            reset ? undefined : cursor,
            50,
            feedFilter
          );
        }
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
    [actorId, feedFilter, cursor]
  );

  useEffect(() => {
    setLoading(true);
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setFeed([]);
    setCursor(undefined);
    loadFeed(true);
  }, [actorId, feedFilter]);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await Promise.all([loadProfile(), loadFeed(true)]);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadProfile, loadFeed]
  );

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

  const handleFollow = useCallback(async () => {
    if (!profile) return;
    if (following) {
      setFollowing(false);
      try {
        await api.unfollow(followUri);
        setFollowUri('');
        setProfile((p) =>
          p ? { ...p, followersCount: (p.followersCount ?? 1) - 1 } : p
        );
      } catch {
        setFollowing(true);
      }
    } else {
      setFollowing(true);
      try {
        const res = await api.follow(profile.did);
        setFollowUri(res.uri);
        setProfile((p) =>
          p ? { ...p, followersCount: (p.followersCount ?? 0) + 1 } : p
        );
      } catch {
        setFollowing(false);
      }
    }
  }, [following, followUri, profile]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

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
            {profile?.displayName || profile?.handle || 'Profile'}
          </IonTitle>
          <IonButtons slot="end">
            {isOwnProfile ? (
              <>
                <IonButton
                  onClick={() => history.push('/moderation')}
                >
                  <IonIcon icon={shieldOutline} />
                </IonButton>
                <IonButton onClick={handleLogout}>
                  <IonIcon icon={logOutOutline} />
                </IonButton>
              </>
            ) : profile ? (
              <IonButton onClick={() => setActionsOpen(true)}>
                <IonIcon icon={ellipsisHorizontal} />
              </IonButton>
            ) : null}
          </IonButtons>
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
        ) : profile ? (
          <>
            {/* Blocked banner */}
            {profile.viewer?.blocking && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderBottom: '1px solid var(--hb-border)',
                  fontSize: 13,
                  color: 'var(--hb-like)',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                You have blocked this account
              </div>
            )}

            {/* Muted banner */}
            {profile.viewer?.muted && !profile.viewer?.blocking && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderBottom: '1px solid var(--hb-border)',
                  fontSize: 13,
                  color: 'var(--hb-bookmark)',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                You have muted this account
              </div>
            )}

            {/* Banner */}
            {profile.banner ? (
              <img className="profile-banner" src={profile.banner} alt="" />
            ) : (
              <div className="profile-banner" />
            )}

            {/* Profile Info */}
            <div className="profile-header-section">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <img
                  className="profile-avatar-large"
                  src={profile.avatar || DEFAULT_AVATAR}
                  alt=""
                />
                {!isOwnProfile && (
                  <IonButton
                    fill={following ? 'outline' : 'solid'}
                    size="small"
                    onClick={handleFollow}
                    style={{
                      '--border-radius': '20px',
                      fontSize: 13,
                      fontWeight: 700,
                      minHeight: 34,
                    }}
                  >
                    {following ? 'Following' : 'Follow'}
                  </IonButton>
                )}
              </div>

              <div className="profile-names">
                <div className="profile-display-name">
                  {profile.displayName || profile.handle}
                </div>
                <div className="profile-handle">@{profile.handle}</div>
              </div>

              {profile.description && (
                <div className="profile-bio">{profile.description}</div>
              )}

              {/* Tappable stats linking to followers/following */}
              <div className="profile-stats">
                <span
                  className="profile-stat"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    history.push(
                      `/follows/${profile.did}?tab=following`
                    )
                  }
                >
                  <strong>{formatCount(profile.followsCount)}</strong>{' '}
                  following
                </span>
                <span
                  className="profile-stat"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    history.push(
                      `/follows/${profile.did}?tab=followers`
                    )
                  }
                >
                  <strong>{formatCount(profile.followersCount)}</strong>{' '}
                  followers
                </span>
                <span className="profile-stat">
                  <strong>{formatCount(profile.postsCount)}</strong> posts
                </span>
              </div>

              {profile.viewer?.followedBy && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '4px 10px',
                    background: 'var(--hb-surface-raised)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--hb-text-muted)',
                    display: 'inline-block',
                  }}
                >
                  Follows you
                </div>
              )}

              {/* Quick access buttons (own profile) */}
              {isOwnProfile && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  {[
                    { icon: gridOutline, label: 'Feeds', path: '/feeds' },
                    { icon: listOutline, label: 'Lists', path: '/lists' },
                    { icon: bookmarkOutline, label: 'Bookmarks', path: '/bookmarks' },
                  ].map((item) => (
                    <IonButton
                      key={item.path}
                      fill="outline"
                      size="small"
                      onClick={() => history.push(item.path)}
                      style={{
                        '--border-radius': '10px',
                        fontSize: 12,
                        fontWeight: 600,
                        minHeight: 32,
                      }}
                    >
                      <IonIcon icon={item.icon} slot="start" style={{ fontSize: 15 }} />
                      {item.label}
                    </IonButton>
                  ))}
                </div>
              )}

              {/* Message button (other profiles) */}
              {!isOwnProfile && (
                <div style={{ marginTop: 10 }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    onClick={() => {
                      api.getConvoForMembers([profile.did])
                        .then((res) => history.push(`/messages/${res.convo.id}`))
                        .catch(() => present({ message: 'Failed to open chat', duration: 2000, position: 'top', color: 'danger' }));
                    }}
                    style={{
                      '--border-radius': '10px',
                      fontSize: 12,
                      fontWeight: 600,
                      minHeight: 32,
                    }}
                  >
                    <IonIcon icon={chatbubblesOutline} slot="start" style={{ fontSize: 15 }} />
                    Message
                  </IonButton>
                </div>
              )}

              {profile.viewer?.blockedBy && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '4px 10px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--hb-like)',
                    display: 'inline-block',
                  }}
                >
                  This user has blocked you
                </div>
              )}
            </div>

            {/* Feed Filter */}
            <div style={{ padding: '0 16px 12px' }}>
              <IonSegment
                value={feedFilter}
                onIonChange={(e) =>
                  setFeedFilter(e.detail.value as FeedFilter)
                }
              >
                <IonSegmentButton value="posts_with_replies">
                  <IonLabel>Posts</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="posts_no_replies">
                  <IonLabel>No Replies</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="posts_with_media">
                  <IonLabel>Media</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="likes">
                  <IonLabel>Likes</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            {/* Feed */}
            {feedLoading && feed.length === 0 ? (
              <div className="loading-center">
                <IonSpinner name="crescent" />
              </div>
            ) : feed.length === 0 ? (
              <div className="empty-state">
                <h3>No posts yet</h3>
              </div>
            ) : (
              feed.map((item, i) => (
                <PostCard key={`${item.post.uri}-${i}`} feedItem={item} />
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
            <h3>Profile not found</h3>
          </div>
        )}

        {/* User Actions Sheet (block/mute/report) */}
        {profile && !isOwnProfile && (
          <UserActionsSheet
            isOpen={actionsOpen}
            onDismiss={() => setActionsOpen(false)}
            profile={profile}
            onUpdate={loadProfile}
          />
        )}
      </IonContent>
    </IonPage>
  );
}
