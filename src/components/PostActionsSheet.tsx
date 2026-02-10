/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Post Actions Sheet Component
   ────────────────────────────────────────────────────────── */

import React, { useCallback, useState } from 'react';
import {
  IonActionSheet,
  IonAlert,
  useIonToast,
} from '@ionic/react';
import { api } from '../services/api';
import type { PostView } from '../types';

interface PostActionsSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  post: PostView;
  onDeleted?: () => void;
  onThreadMuteToggled?: (muted: boolean) => void;
}

export default function PostActionsSheet({
  isOpen,
  onDismiss,
  post,
  onDeleted,
  onThreadMuteToggled,
}: PostActionsSheetProps) {
  const [present] = useIonToast();
  const [reportAlertOpen, setReportAlertOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isOwnPost = post.author.did === api.getDid();
  const isThreadMuted = !!post.viewer?.threadMuted;

  const handleDelete = useCallback(async () => {
    try {
      await api.deletePost(post.uri);
      present({
        message: 'Post deleted',
        duration: 2000,
        position: 'top',
        color: 'success',
      });
      onDeleted?.();
    } catch (err) {
      present({
        message: `Failed to delete: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
    }
  }, [post.uri, present, onDeleted]);

  const handleMuteThread = useCallback(async () => {
    try {
      // Use the root URI for thread muting, or the post's own URI
      const rootUri = post.record?.reply?.root?.uri || post.uri;
      if (isThreadMuted) {
        await api.unmuteThread(rootUri);
        present({
          message: 'Thread unmuted',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        onThreadMuteToggled?.(false);
      } else {
        await api.muteThread(rootUri);
        present({
          message: 'Thread muted',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        onThreadMuteToggled?.(true);
      }
    } catch (err) {
      present({
        message: `Failed: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
    }
  }, [post.uri, post.record, isThreadMuted, present, onThreadMuteToggled]);

  const handleReport = useCallback(
    async (reasonType: string) => {
      try {
        await api.reportPost(post.uri, post.cid, reasonType);
        present({
          message: 'Report submitted. Thank you.',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      } catch (err) {
        present({
          message: `Failed to report: ${(err as Error).message}`,
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
      }
    },
    [post.uri, post.cid, present]
  );

  const handleCopyLink = useCallback(() => {
    // Convert at:// URI to bsky.app link
    const parts = post.uri.replace('at://', '').split('/');
    const handle = post.author.handle;
    const rkey = parts[2];
    const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
    navigator.clipboard.writeText(url).then(() => {
      present({
        message: 'Link copied',
        duration: 1500,
        position: 'top',
      });
    });
  }, [post.uri, post.author.handle, present]);

  const handleCopyText = useCallback(() => {
    if (post.record.text) {
      navigator.clipboard.writeText(post.record.text).then(() => {
        present({
          message: 'Text copied',
          duration: 1500,
          position: 'top',
        });
      });
    }
  }, [post.record.text, present]);

  const buttons = [
    ...(isOwnPost
      ? [
          {
            text: 'Delete Post',
            role: 'destructive' as const,
            handler: () => {
              setTimeout(() => setDeleteConfirmOpen(true), 200);
            },
          },
        ]
      : []),
    {
      text: isThreadMuted ? 'Unmute Thread' : 'Mute Thread',
      handler: handleMuteThread,
    },
    ...(!isOwnPost
      ? [
          {
            text: 'Report Post',
            role: 'destructive' as const,
            handler: () => {
              setTimeout(() => setReportAlertOpen(true), 200);
            },
          },
        ]
      : []),
    {
      text: 'Copy Link',
      handler: handleCopyLink,
    },
    ...(post.record.text
      ? [
          {
            text: 'Copy Text',
            handler: handleCopyText,
          },
        ]
      : []),
    {
      text: 'Cancel',
      role: 'cancel' as const,
    },
  ];

  return (
    <>
      <IonActionSheet
        isOpen={isOpen}
        onDidDismiss={onDismiss}
        buttons={buttons}
      />

      <IonAlert
        isOpen={deleteConfirmOpen}
        onDidDismiss={() => setDeleteConfirmOpen(false)}
        header="Delete Post"
        message="Are you sure? This cannot be undone."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Delete',
            role: 'destructive',
            handler: handleDelete,
          },
        ]}
      />

      <IonAlert
        isOpen={reportAlertOpen}
        onDidDismiss={() => setReportAlertOpen(false)}
        header="Report Post"
        message="Why are you reporting this post?"
        buttons={[
          { text: 'Spam', handler: () => handleReport('reasonSpam') },
          { text: 'Misleading', handler: () => handleReport('reasonMisleading') },
          { text: 'Violation', handler: () => handleReport('reasonViolation') },
          { text: 'Other', handler: () => handleReport('reasonOther') },
          { text: 'Cancel', role: 'cancel' },
        ]}
      />
    </>
  );
}
