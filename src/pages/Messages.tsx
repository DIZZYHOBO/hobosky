/* ──────────────────────────────────────────────────────────
   HoboSky v0.3.0 — Direct Messages Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonIcon,
  IonButton,
  IonButtons,
  IonBackButton,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  useIonToast,
} from '@ionic/react';
import {
  chatbubblesOutline,
  sendOutline,
  createOutline,
} from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type {
  ConvoView,
  ChatMessageView,
  ChatDeletedMessageView,
} from '../types';
import { timeAgo, DEFAULT_AVATAR } from '../utils';

/* ── Conversation List View ──────────────────────────── */

export default function MessagesPage() {
  const history = useHistory();
  const [convos, setConvos] = useState<ConvoView[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const loadConvos = useCallback(
    async (reset = true) => {
      setLoading(reset);
      try {
        const res = await api.listConvos(reset ? undefined : cursor, 25);
        if (reset) {
          setConvos(res.convos);
        } else {
          setConvos((prev) => [...prev, ...res.convos]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    },
    [cursor]
  );

  useEffect(() => {
    loadConvos(true);
  }, []);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadConvos(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadConvos]
  );

  const handleInfiniteScroll = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadConvos(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, loadConvos]
  );

  const myDid = api.getDid();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}
          >
            Messages
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/messages/new')}>
              <IonIcon icon={createOutline} />
            </IonButton>
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
        ) : convos.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={chatbubblesOutline} />
            <h3>No messages yet</h3>
            <p>Start a conversation from someone's profile</p>
          </div>
        ) : (
          convos.map((convo) => {
            const other = convo.members.find((m) => m.did !== myDid);
            const lastMsg = convo.lastMessage;
            let lastText = '';
            if (lastMsg && '$type' in lastMsg) {
              if (lastMsg.$type === 'chat.bsky.convo.defs#messageView') {
                const msg = lastMsg as ChatMessageView;
                const isMine = msg.sender.did === myDid;
                lastText = isMine
                  ? `You: ${msg.text}`
                  : msg.text;
              } else {
                lastText = 'Message deleted';
              }
            }

            return (
              <div
                key={convo.id}
                className="search-user-item"
                onClick={() => history.push(`/messages/${convo.id}`)}
                style={{
                  background:
                    convo.unreadCount > 0
                      ? 'rgba(14, 165, 233, 0.05)'
                      : undefined,
                }}
              >
                <img
                  className="post-avatar"
                  src={other?.avatar || DEFAULT_AVATAR}
                  alt=""
                />
                <div
                  className="search-user-info"
                  style={{ minWidth: 0 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      className="search-user-name"
                      style={{
                        fontWeight: convo.unreadCount > 0 ? 700 : 600,
                      }}
                    >
                      {other?.displayName || other?.handle || 'Unknown'}
                    </div>
                    {lastMsg && 'sentAt' in lastMsg && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--hb-text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {timeAgo(lastMsg.sentAt)}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: convo.unreadCount > 0
                        ? 'var(--hb-text-secondary)'
                        : 'var(--hb-text-muted)',
                      fontWeight: convo.unreadCount > 0 ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}
                  >
                    {lastText || 'No messages'}
                  </div>
                </div>
                {convo.unreadCount > 0 && (
                  <div
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      background: 'var(--hb-accent)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 6px',
                      flexShrink: 0,
                    }}
                  >
                    {convo.unreadCount > 99 ? '99+' : convo.unreadCount}
                  </div>
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

/* ── Single Conversation Chat View ────────────────────── */

export function ChatPage() {
  const { convoId } = useParams<{ convoId: string }>();
  const history = useHistory();
  const [present] = useIonToast();

  const [convo, setConvo] = useState<ConvoView | null>(null);
  const [messages, setMessages] = useState<
    (ChatMessageView | ChatDeletedMessageView)[]
  >([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const contentRef = useRef<HTMLIonContentElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myDid = api.getDid();

  const loadConvo = useCallback(async () => {
    try {
      const res = await api.getConvo(convoId);
      setConvo(res.convo);
    } catch (err) {
      console.error('Failed to load convo:', err);
    }
  }, [convoId]);

  const loadMessages = useCallback(
    async (reset = true) => {
      setLoading(reset);
      try {
        const res = await api.getMessages(
          convoId,
          reset ? undefined : cursor,
          50
        );
        // Messages come newest-first from API, reverse for display
        const msgs = [...res.messages].reverse();
        if (reset) {
          setMessages(msgs);
        } else {
          // Older messages prepend
          setMessages((prev) => [...msgs, ...prev]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    },
    [convoId, cursor]
  );

  useEffect(() => {
    loadConvo();
    loadMessages(true);

    // Mark as read
    api.updateConvoRead(convoId).catch(() => {});

    // Poll for new messages every 3 seconds
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.getMessages(convoId, undefined, 10);
        const newest = [...res.messages].reverse();
        setMessages((prev) => {
          const existingIds = new Set(
            prev.map((m) => m.id)
          );
          const fresh = newest.filter(
            (m) => !existingIds.has(m.id)
          );
          if (fresh.length > 0) {
            api.updateConvoRead(convoId).catch(() => {});
            return [...prev, ...fresh];
          }
          return prev;
        });
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [convoId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    setTimeout(() => {
      contentRef.current?.scrollToBottom(200);
    }, 100);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      const sent = await api.sendMessage(convoId, msg);
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => contentRef.current?.scrollToBottom(200), 100);
    } catch (err) {
      present({
        message: `Failed to send: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
      setText(msg);
    } finally {
      setSending(false);
    }
  }, [text, sending, convoId, present]);

  const handleLoadMore = useCallback(
    async (event: CustomEvent) => {
      if (!cursor) {
        (event.target as HTMLIonInfiniteScrollElement).complete();
        (event.target as HTMLIonInfiniteScrollElement).disabled = true;
        return;
      }
      await loadMessages(false);
      (event.target as HTMLIonInfiniteScrollElement).complete();
    },
    [cursor, loadMessages]
  );

  const other = convo?.members.find((m) => m.did !== myDid);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/messages" />
          </IonButtons>
          <IonTitle
            style={{
              fontFamily: 'Outfit',
              fontWeight: 700,
              fontSize: 17,
              cursor: other ? 'pointer' : undefined,
            }}
            onClick={() =>
              other && history.push(`/profile/${other.did}`)
            }
          >
            {other?.displayName || other?.handle || 'Chat'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef}>
        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              gap: 4,
              minHeight: '100%',
            }}
          >
            {messages.map((msg) => {
              const isDeleted =
                '$type' in msg &&
                msg.$type ===
                  'chat.bsky.convo.defs#deletedMessageView';
              const isMine = msg.sender.did === myDid;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isMine
                      ? 'flex-end'
                      : 'flex-start',
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '75%',
                      padding: '10px 14px',
                      borderRadius: isMine
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                      background: isMine
                        ? 'var(--hb-accent)'
                        : 'var(--hb-surface-raised)',
                      color: isMine ? '#fff' : 'var(--hb-text-primary)',
                      fontSize: 14,
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                    }}
                  >
                    {isDeleted ? (
                      <span
                        style={{
                          fontStyle: 'italic',
                          opacity: 0.6,
                        }}
                      >
                        Message deleted
                      </span>
                    ) : (
                      (msg as ChatMessageView).text
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.6,
                        marginTop: 4,
                        textAlign: 'right',
                      }}
                    >
                      {timeAgo(msg.sentAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </IonContent>

      {/* Message Input */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderTop: '1px solid var(--hb-border)',
          background: 'var(--hb-bg)',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1,
            background: 'var(--hb-surface-raised)',
            border: '1px solid var(--hb-border)',
            borderRadius: 20,
            padding: '10px 16px',
            fontSize: 14,
            color: 'var(--hb-text-primary)',
            resize: 'none',
            outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
            maxHeight: 120,
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
        />
        <IonButton
          fill="solid"
          size="small"
          disabled={!text.trim() || sending}
          onClick={handleSend}
          style={{
            '--border-radius': '50%',
            width: 40,
            height: 40,
            marginBottom: 2,
          }}
        >
          {sending ? (
            <IonSpinner
              name="crescent"
              style={{ width: 18, height: 18 }}
            />
          ) : (
            <IonIcon icon={sendOutline} />
          )}
        </IonButton>
      </div>
    </IonPage>
  );
}

/* ── New Conversation Page ────────────────────────────── */

export function NewMessagePage() {
  const history = useHistory();
  const [present] = useIonToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    { did: string; handle: string; displayName?: string; avatar?: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchActorsTypeahead(q, 10);
        setResults(res.actors);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const startConvo = useCallback(
    async (did: string) => {
      try {
        const res = await api.getConvoForMembers([did]);
        history.replace(`/messages/${res.convo.id}`);
      } catch (err) {
        present({
          message: `Failed to start conversation: ${(err as Error).message}`,
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
      }
    },
    [history, present]
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/messages" />
          </IonButtons>
          <IonTitle
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}
          >
            New Message
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: 16 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a user..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--hb-border)',
              background: 'var(--hb-surface-raised)',
              color: 'var(--hb-text-primary)',
              fontSize: 15,
              outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>

        {searching && (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        )}

        {results.map((user) => (
          <div
            key={user.did}
            className="search-user-item"
            onClick={() => startConvo(user.did)}
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
          </div>
        ))}
      </IonContent>
    </IonPage>
  );
}
