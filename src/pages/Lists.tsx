/* ──────────────────────────────────────────────────────────
   HoboSky v0.3.0 — Lists Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonButton,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonFab,
  IonFabButton,
  IonAlert,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  useIonToast,
} from '@ionic/react';
import { addOutline, listOutline, trashOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { ListView, ListItemView, FeedViewPost } from '../types';
import PostCard from '../components/PostCard';
import { DEFAULT_AVATAR } from '../utils';

/* ── My Lists ─────────────────────────────────────────── */

export default function ListsPage() {
  const history = useHistory();
  const [present] = useIonToast();
  const [lists, setLists] = useState<ListView[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const loadLists = useCallback(
    async (reset = true) => {
      setLoading(reset);
      try {
        const did = api.getDid()!;
        const res = await api.getLists(
          did,
          reset ? undefined : cursor,
          50
        );
        if (reset) {
          setLists(res.lists);
        } else {
          setLists((prev) => [...prev, ...res.lists]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load lists:', err);
      } finally {
        setLoading(false);
      }
    },
    [cursor]
  );

  useEffect(() => {
    loadLists(true);
  }, []);

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      await loadLists(true);
      (event.target as HTMLIonRefresherElement).complete();
    },
    [loadLists]
  );

  const handleCreateList = useCallback(
    async (data: { name: string; purpose: string; description?: string }) => {
      try {
        await api.createList(data.name, data.purpose, data.description);
        present({
          message: 'List created!',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        loadLists(true);
      } catch (err) {
        present({
          message: `Failed: ${(err as Error).message}`,
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
      }
    },
    [present, loadLists]
  );

  const purposeLabel = (purpose: string) => {
    if (purpose.includes('modlist')) return 'Mod List';
    if (purpose.includes('curatelist')) return 'User List';
    if (purpose.includes('referencelist')) return 'Reference';
    return 'List';
  };

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
            My Lists
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
        ) : lists.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={listOutline} />
            <h3>No lists yet</h3>
            <p>Create lists to organize accounts</p>
          </div>
        ) : (
          lists.map((list) => (
            <div
              key={list.uri}
              className="search-user-item"
              onClick={() =>
                history.push(
                  `/lists/${encodeURIComponent(list.uri)}`
                )
              }
            >
              <img
                className="post-avatar"
                src={list.avatar || DEFAULT_AVATAR}
                alt=""
                style={{ borderRadius: 8 }}
              />
              <div className="search-user-info">
                <div className="search-user-name">{list.name}</div>
                <div className="search-user-handle">
                  {purposeLabel(list.purpose)} · {list.listItemCount ?? 0}{' '}
                  {(list.listItemCount ?? 0) === 1 ? 'member' : 'members'}
                </div>
                {list.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--hb-text-muted)',
                      marginTop: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {list.description}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        <IonInfiniteScroll
          threshold="200px"
          disabled={!cursor}
          onIonInfinite={async (e) => {
            if (!cursor) {
              (e.target as HTMLIonInfiniteScrollElement).complete();
              return;
            }
            await loadLists(false);
            (e.target as HTMLIonInfiniteScrollElement).complete();
          }}
        >
          <IonInfiniteScrollContent loadingSpinner="crescent" />
        </IonInfiniteScroll>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setCreateOpen(true)}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        <IonAlert
          isOpen={createOpen}
          onDidDismiss={() => setCreateOpen(false)}
          header="Create List"
          inputs={[
            {
              name: 'name',
              type: 'text',
              placeholder: 'List name',
            },
            {
              name: 'description',
              type: 'textarea',
              placeholder: 'Description (optional)',
            },
          ]}
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            {
              text: 'Create Curate List',
              handler: (data: { name: string; description?: string }) => {
                if (data.name?.trim()) {
                  handleCreateList({
                    name: data.name.trim(),
                    purpose: 'app.bsky.graph.defs#curatelist',
                    description: data.description?.trim(),
                  });
                }
              },
            },
            {
              text: 'Create Mod List',
              handler: (data: { name: string; description?: string }) => {
                if (data.name?.trim()) {
                  handleCreateList({
                    name: data.name.trim(),
                    purpose: 'app.bsky.graph.defs#modlist',
                    description: data.description?.trim(),
                  });
                }
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
}

/* ── List Detail View ─────────────────────────────────── */

export function ListDetailPage() {
  const { uri } = useParams<{ uri: string }>();
  const decodedUri = decodeURIComponent(uri);
  const history = useHistory();
  const [present] = useIonToast();

  const [list, setList] = useState<ListView | null>(null);
  const [items, setItems] = useState<ListItemView[]>([]);
  const [feed, setFeed] = useState<FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [feedCursor, setFeedCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'feed'>('members');

  const loadList = useCallback(
    async (reset = true) => {
      setLoading(reset);
      try {
        const res = await api.getList(
          decodedUri,
          reset ? undefined : cursor,
          50
        );
        setList(res.list);
        if (reset) {
          setItems(res.items);
        } else {
          setItems((prev) => [...prev, ...res.items]);
        }
        setCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load list:', err);
      } finally {
        setLoading(false);
      }
    },
    [decodedUri, cursor]
  );

  const loadFeed = useCallback(
    async (reset = true) => {
      try {
        const res = await api.getListFeed(
          decodedUri,
          reset ? undefined : feedCursor,
          30
        );
        if (reset) {
          setFeed(res.feed);
        } else {
          setFeed((prev) => [...prev, ...res.feed]);
        }
        setFeedCursor(res.cursor);
      } catch (err) {
        console.error('Failed to load list feed:', err);
      }
    },
    [decodedUri, feedCursor]
  );

  useEffect(() => {
    loadList(true);
  }, [decodedUri]);

  useEffect(() => {
    if (tab === 'feed') {
      setFeed([]);
      setFeedCursor(undefined);
      loadFeed(true);
    }
  }, [tab]);

  const handleDelete = useCallback(async () => {
    try {
      await api.deleteList(decodedUri);
      present({
        message: 'List deleted',
        duration: 2000,
        position: 'top',
        color: 'success',
      });
      history.goBack();
    } catch (err) {
      present({
        message: `Failed: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
    }
  }, [decodedUri, present, history]);

  const handleRemoveMember = useCallback(
    async (itemUri: string) => {
      try {
        await api.removeFromList(itemUri);
        setItems((prev) => prev.filter((item) => item.uri !== itemUri));
        present({
          message: 'Removed from list',
          duration: 1500,
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

  const isOwnList = list?.creator.did === api.getDid();
  const isCurateList = list?.purpose.includes('curatelist');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/lists" />
          </IonButtons>
          <IonTitle
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}
          >
            {list?.name || 'List'}
          </IonTitle>
          {isOwnList && (
            <IonButtons slot="end">
              <IonButton color="danger" onClick={handleDelete}>
                <IonIcon icon={trashOutline} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        {isCurateList && (
          <IonToolbar style={{ '--min-height': '44px' }}>
            <IonSegment
              value={tab}
              onIonChange={(e) =>
                setTab(e.detail.value as 'members' | 'feed')
              }
            >
              <IonSegmentButton value="members">
                <IonLabel>Members</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="feed">
                <IonLabel>Feed</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent>
        {loading ? (
          <div className="loading-center">
            <IonSpinner name="crescent" />
          </div>
        ) : list ? (
          <>
            {/* List Info Header */}
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid var(--hb-border)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--hb-text-muted)',
                  marginBottom: 4,
                }}
              >
                Created by @{list.creator.handle} ·{' '}
                {list.listItemCount ?? 0} members
              </div>
              {list.description && (
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--hb-text-secondary)',
                    lineHeight: 1.45,
                  }}
                >
                  {list.description}
                </div>
              )}
            </div>

            {tab === 'members' ? (
              /* Members list */
              items.length === 0 ? (
                <div className="empty-state">
                  <h3>No members yet</h3>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.uri}
                    className="search-user-item"
                    onClick={() =>
                      history.push(`/profile/${item.subject.did}`)
                    }
                  >
                    <img
                      className="post-avatar"
                      src={item.subject.avatar || DEFAULT_AVATAR}
                      alt=""
                    />
                    <div className="search-user-info">
                      <div className="search-user-name">
                        {item.subject.displayName || item.subject.handle}
                      </div>
                      <div className="search-user-handle">
                        @{item.subject.handle}
                      </div>
                    </div>
                    {isOwnList && (
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMember(item.uri);
                        }}
                      >
                        <IonIcon icon={trashOutline} />
                      </IonButton>
                    )}
                  </div>
                ))
              )
            ) : (
              /* Feed view */
              feed.length === 0 ? (
                <div className="empty-state">
                  <h3>No posts in this list feed</h3>
                </div>
              ) : (
                feed.map((item, i) => (
                  <PostCard
                    key={`${item.post.uri}-${i}`}
                    feedItem={item}
                  />
                ))
              )
            )}

            <IonInfiniteScroll
              threshold="200px"
              disabled={tab === 'members' ? !cursor : !feedCursor}
              onIonInfinite={async (e) => {
                if (tab === 'members') {
                  if (!cursor) {
                    (e.target as HTMLIonInfiniteScrollElement).complete();
                    return;
                  }
                  await loadList(false);
                } else {
                  if (!feedCursor) {
                    (e.target as HTMLIonInfiniteScrollElement).complete();
                    return;
                  }
                  await loadFeed(false);
                }
                (e.target as HTMLIonInfiniteScrollElement).complete();
              }}
            >
              <IonInfiniteScrollContent loadingSpinner="crescent" />
            </IonInfiniteScroll>
          </>
        ) : (
          <div className="empty-state">
            <h3>List not found</h3>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
