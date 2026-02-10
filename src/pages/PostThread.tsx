/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Post Thread Page
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
  IonIcon,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import {
  chatbubbleOutline,
  repeatOutline,
  heartOutline,
  heart,
  repeat,
} from 'ionicons/icons';
import { api } from '../services/api';
import type { ThreadViewPost, PostView } from '../types';
import PostCard from '../components/PostCard';
import ComposeModal from '../components/ComposeModal';
import {
  timeAgo,
  formatCount,
  renderTextWithFacets,
  DEFAULT_AVATAR,
} from '../utils';
import { useHistory } from 'react-router-dom';

export default function PostThreadPage() {
  const { uri } = useParams<{ uri: string }>();
  const decodedUri = decodeURIComponent(uri);
  const history = useHistory();

  const [thread, setThread] = useState<ThreadViewPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeUri, setLikeUri] = useState('');
  const [likeCount, setLikeCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [repostUri, setRepostUri] = useState('');
  const [repostCount, setRepostCount] = useState(0);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getPostThread(decodedUri);
      if ('post' in res.thread) {
        const t = res.thread as ThreadViewPost;
        setThread(t);
        setLiked(!!t.post.viewer?.like);
        setLikeUri(t.post.viewer?.like || '');
        setLikeCount(t.post.likeCount ?? 0);
        setReposted(!!t.post.viewer?.repost);
        setRepostUri(t.post.viewer?.repost || '');
        setRepostCount(t.post.repostCount ?? 0);
      } else {
        setError('Post not found or blocked');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [decodedUri]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const handleLike = useCallback(async () => {
    if (!thread) return;
    const post = thread.post;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      try {
        await api.unlike(likeUri);
        setLikeUri('');
      } catch {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      try {
        const res = await api.like({ uri: post.uri, cid: post.cid });
        setLikeUri(res.uri);
      } catch {
        setLiked(false);
        setLikeCount((c) => c - 1);
      }
    }
  }, [liked, likeUri, thread]);

  const handleRepost = useCallback(async () => {
    if (!thread) return;
    const post = thread.post;
    if (reposted) {
      setReposted(false);
      setRepostCount((c) => c - 1);
      try {
        await api.unrepost(repostUri);
        setRepostUri('');
      } catch {
        setReposted(true);
        setRepostCount((c) => c + 1);
      }
    } else {
      setReposted(true);
      setRepostCount((c) => c + 1);
      try {
        const res = await api.repost({ uri: post.uri, cid: post.cid });
        setRepostUri(res.uri);
      } catch {
        setReposted(false);
        setRepostCount((c) => c - 1);
      }
    }
  }, [reposted, repostUri, thread]);

  // Collect parent chain
  const parents: ThreadViewPost[] = [];
  if (thread) {
    let current = thread.parent;
    while (current && 'post' in current) {
      parents.unshift(current as ThreadViewPost);
      current = (current as ThreadViewPost).parent;
    }
  }

  const mainPost = thread?.post;
  const replies = (thread?.replies || []).filter(
    (r) => r && 'post' in r
  ) as ThreadViewPost[];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}>
            Post
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        ) : mainPost ? (
          <>
            {/* Parent posts */}
            {parents.map((p, i) => (
              <PostCard
                key={p.post.uri}
                post={p.post}
                showParentConnector={i < parents.length - 1}
                isThread
              />
            ))}
            {parents.length > 0 && (
              <div
                style={{
                  marginLeft: 37,
                  width: 2,
                  height: 16,
                  background: 'var(--hb-border)',
                }}
              />
            )}

            {/* Main post (expanded) */}
            <div className="thread-main-post">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img
                  className="post-avatar"
                  src={mainPost.author.avatar || DEFAULT_AVATAR}
                  alt=""
                  onClick={() => history.push(`/profile/${mainPost.author.did}`)}
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <div
                    className="post-display-name"
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      history.push(`/profile/${mainPost.author.did}`)
                    }
                  >
                    {mainPost.author.displayName || mainPost.author.handle}
                  </div>
                  <div className="post-handle">@{mainPost.author.handle}</div>
                </div>
              </div>

              {mainPost.record.text && (
                <div
                  className="post-text"
                  style={{ fontSize: 17, marginTop: 14 }}
                  dangerouslySetInnerHTML={{
                    __html: renderTextWithFacets(
                      mainPost.record.text,
                      mainPost.record.facets
                    ),
                  }}
                />
              )}

              <div
                style={{
                  fontSize: 13,
                  color: 'var(--hb-text-muted)',
                  marginTop: 14,
                }}
              >
                {new Date(mainPost.indexedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>

              {(likeCount > 0 || repostCount > 0 || (mainPost.replyCount ?? 0) > 0) && (
                <div className="thread-main-stats">
                  {(mainPost.replyCount ?? 0) > 0 && (
                    <span>
                      <strong>{formatCount(mainPost.replyCount)}</strong> replies
                    </span>
                  )}
                  {repostCount > 0 && (
                    <span>
                      <strong>{formatCount(repostCount)}</strong> reposts
                    </span>
                  )}
                  {likeCount > 0 && (
                    <span>
                      <strong>{formatCount(likeCount)}</strong> likes
                    </span>
                  )}
                  {(mainPost.quoteCount ?? 0) > 0 && (
                    <span>
                      <strong>{formatCount(mainPost.quoteCount)}</strong> quotes
                    </span>
                  )}
                </div>
              )}

              <div
                className="post-actions"
                style={{ borderTop: '1px solid var(--hb-border)', paddingTop: 8 }}
              >
                <button
                  className="post-action-btn reply-btn"
                  onClick={() => setComposeOpen(true)}
                >
                  <IonIcon icon={chatbubbleOutline} />
                  Reply
                </button>
                <button
                  className={`post-action-btn repost-btn ${reposted ? 'active' : ''}`}
                  onClick={handleRepost}
                >
                  <IonIcon icon={reposted ? repeat : repeatOutline} />
                  {reposted ? 'Reposted' : 'Repost'}
                </button>
                <button
                  className={`post-action-btn like-btn ${liked ? 'active' : ''}`}
                  onClick={handleLike}
                >
                  <IonIcon icon={liked ? heart : heartOutline} />
                  {liked ? 'Liked' : 'Like'}
                </button>
              </div>
            </div>

            {/* Replies */}
            {replies.length > 0 && (
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--hb-text-muted)',
                  borderBottom: '1px solid var(--hb-border)',
                  fontFamily: 'Outfit',
                }}
              >
                Replies
              </div>
            )}
            {replies.map((r) => (
              <PostCard key={r.post.uri} post={r.post} isThread />
            ))}

            <ComposeModal
              isOpen={composeOpen}
              onDismiss={() => setComposeOpen(false)}
              replyTo={{
                uri: mainPost.uri,
                cid: mainPost.cid,
                root: parents.length > 0
                  ? { uri: parents[0].post.uri, cid: parents[0].post.cid }
                  : undefined,
                author: {
                  handle: mainPost.author.handle,
                  displayName: mainPost.author.displayName,
                },
                text: mainPost.record.text,
              }}
              onSuccess={loadThread}
            />
          </>
        ) : null}
      </IonContent>
    </IonPage>
  );
}
