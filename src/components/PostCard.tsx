/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — PostCard Component
   ────────────────────────────────────────────────────────── */

import React, { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import {
  chatbubbleOutline,
  repeatOutline,
  heartOutline,
  heart,
  bookmarkOutline,
  bookmark,
  repeat,
  ellipsisHorizontal,
} from 'ionicons/icons';
import { api } from '../services/api';
import type { PostView, FeedViewPost, EmbedView } from '../types';
import {
  timeAgo,
  formatCount,
  renderTextWithFacets,
  extractDomain,
  DEFAULT_AVATAR,
} from '../utils';

interface PostCardProps {
  feedItem?: FeedViewPost;
  post?: PostView;
  isThread?: boolean;
  showParentConnector?: boolean;
}

export default function PostCard({
  feedItem,
  post: directPost,
  isThread = false,
  showParentConnector = false,
}: PostCardProps) {
  const history = useHistory();
  const post = feedItem?.post ?? directPost;

  const [liked, setLiked] = useState(!!post?.viewer?.like);
  const [likeUri, setLikeUri] = useState(post?.viewer?.like || '');
  const [likeCount, setLikeCount] = useState(post?.likeCount ?? 0);

  const [reposted, setReposted] = useState(!!post?.viewer?.repost);
  const [repostUri, setRepostUri] = useState(post?.viewer?.repost || '');
  const [repostCount, setRepostCount] = useState(post?.repostCount ?? 0);

  if (!post) return null;

  const record = post.record;
  const reason = feedItem?.reason;
  const isRepost = reason && '$type' in reason && reason.$type === 'app.bsky.feed.defs#reasonRepost';

  const navigateToThread = useCallback(() => {
    const encoded = encodeURIComponent(post.uri);
    history.push(`/thread/${encoded}`);
  }, [history, post.uri]);

  const navigateToProfile = useCallback(
    (e: React.MouseEvent, did: string) => {
      e.stopPropagation();
      history.push(`/profile/${did}`);
    },
    [history]
  );

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
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
    },
    [liked, likeUri, post.uri, post.cid]
  );

  const handleRepost = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
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
    },
    [reposted, repostUri, post.uri, post.cid]
  );

  const handleReply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const encoded = encodeURIComponent(post.uri);
      history.push(`/compose?reply=${encoded}`);
    },
    [history, post.uri]
  );

  const textHtml = renderTextWithFacets(record.text, record.facets);

  return (
    <>
      {isRepost && (
        <div className="repost-indicator">
          <IonIcon icon={repeatOutline} />
          <span
            onClick={(e) => navigateToProfile(e, (reason as { by: { did: string } }).by.did)}
            style={{ cursor: 'pointer' }}
          >
            {(reason as { by: { displayName?: string; handle: string } }).by.displayName ||
              (reason as { by: { handle: string } }).by.handle}{' '}
            reposted
          </span>
        </div>
      )}
      <div
        className={`post-card ${showParentConnector ? 'thread-parent-connector' : ''}`}
        onClick={navigateToThread}
      >
        <img
          className="post-avatar"
          src={post.author.avatar || DEFAULT_AVATAR}
          alt=""
          onClick={(e) => navigateToProfile(e, post.author.did)}
        />
        <div className="post-body">
          <div className="post-header">
            <span
              className="post-display-name"
              onClick={(e) => navigateToProfile(e, post.author.did)}
            >
              {post.author.displayName || post.author.handle}
            </span>
            <span className="post-handle">@{post.author.handle}</span>
            <span className="post-time">{timeAgo(post.indexedAt)}</span>
          </div>

          {record.reply && !isThread && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--hb-text-muted)',
                marginTop: 2,
                marginBottom: 2,
              }}
            >
              Replying to a thread
            </div>
          )}

          {record.text && (
            <div
              className="post-text"
              dangerouslySetInnerHTML={{ __html: textHtml }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'A') {
                  e.stopPropagation();
                  const mention = target.getAttribute('data-mention');
                  if (mention) {
                    e.preventDefault();
                    history.push(`/profile/${mention}`);
                  }
                  const tag = target.getAttribute('data-tag');
                  if (tag) {
                    e.preventDefault();
                    history.push(`/search?q=${encodeURIComponent('#' + tag)}`);
                  }
                }
              }}
            />
          )}

          {post.embed && <EmbedContent embed={post.embed} history={history} />}

          <div className="post-actions">
            <button className="post-action-btn reply-btn" onClick={handleReply}>
              <IonIcon icon={chatbubbleOutline} />
              {formatCount(post.replyCount)}
            </button>
            <button
              className={`post-action-btn repost-btn ${reposted ? 'active' : ''}`}
              onClick={handleRepost}
            >
              <IonIcon icon={reposted ? repeat : repeatOutline} />
              {formatCount(repostCount)}
            </button>
            <button
              className={`post-action-btn like-btn ${liked ? 'active' : ''}`}
              onClick={handleLike}
            >
              <IonIcon icon={liked ? heart : heartOutline} />
              {formatCount(likeCount)}
            </button>
            <button
              className="post-action-btn bookmark-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <IonIcon icon={bookmarkOutline} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Embed Renderer ────────────────────────────────────── */

function EmbedContent({
  embed,
  history,
}: {
  embed: EmbedView;
  history: ReturnType<typeof useHistory>;
}) {
  const type = embed.$type;

  // Images
  if (type === 'app.bsky.embed.images#view' && embed.images) {
    const images = embed.images;
    return (
      <div
        className={`post-images count-${Math.min(images.length, 4)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {images.slice(0, 4).map((img, i) => (
          <img
            key={i}
            className="post-image"
            src={img.thumb}
            alt={img.alt || ''}
            loading="lazy"
            onClick={() => window.open(img.fullsize, '_blank')}
          />
        ))}
      </div>
    );
  }

  // External link card
  if (type === 'app.bsky.embed.external#view' && embed.external) {
    const ext = embed.external;
    return (
      <div
        className="embed-external"
        onClick={(e) => {
          e.stopPropagation();
          window.open(ext.uri, '_blank', 'noopener');
        }}
      >
        {ext.thumb && (
          <img className="embed-external-thumb" src={ext.thumb} alt="" loading="lazy" />
        )}
        <div className="embed-external-info">
          <div className="embed-external-domain">{extractDomain(ext.uri)}</div>
          <div className="embed-external-title">{ext.title}</div>
          {ext.description && (
            <div className="embed-external-desc">{ext.description}</div>
          )}
        </div>
      </div>
    );
  }

  // Quote post embed
  if (type === 'app.bsky.embed.record#view' && embed.record) {
    const rec = embed.record.record;
    if (!rec || !('$type' in rec) || rec.$type !== 'app.bsky.embed.record#viewRecord') {
      return null;
    }
    const quotePost = rec as {
      uri: string;
      author: { did: string; displayName?: string; handle: string; avatar?: string };
      value: { text?: string };
    };

    return (
      <div
        className="embed-quote"
        onClick={(e) => {
          e.stopPropagation();
          history.push(`/thread/${encodeURIComponent(quotePost.uri)}`);
        }}
      >
        <div className="embed-quote-header">
          <img
            className="post-avatar-small"
            src={quotePost.author.avatar || DEFAULT_AVATAR}
            alt=""
            style={{ width: 20, height: 20 }}
          />
          <span className="post-display-name" style={{ fontSize: 13 }}>
            {quotePost.author.displayName || quotePost.author.handle}
          </span>
          <span className="post-handle" style={{ fontSize: 12 }}>
            @{quotePost.author.handle}
          </span>
        </div>
        {quotePost.value.text && (
          <div className="embed-quote-text">{quotePost.value.text}</div>
        )}
      </div>
    );
  }

  // Record with media (quote + images)
  if (type === 'app.bsky.embed.recordWithMedia#view') {
    return (
      <>
        {embed.media && <EmbedContent embed={embed.media} history={history} />}
        {embed.record && (
          <EmbedContent
            embed={{ $type: 'app.bsky.embed.record#view', record: embed.record }}
            history={history}
          />
        )}
      </>
    );
  }

  // Video embed
  if (type === 'app.bsky.embed.video#view') {
    if (embed.playlist) {
      return (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
          <video
            src={embed.playlist}
            poster={embed.thumbnail}
            controls
            preload="metadata"
            style={{ width: '100%', maxHeight: 500, background: '#000' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      );
    }
    if (embed.thumbnail) {
      return (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
          <img
            src={embed.thumbnail}
            alt={embed.alt || 'Video thumbnail'}
            style={{ width: '100%', maxHeight: 500, objectFit: 'cover' }}
          />
        </div>
      );
    }
    return null;
  }

  return null;
}
