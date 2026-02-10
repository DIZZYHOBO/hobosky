/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — User Actions Sheet Component
   ────────────────────────────────────────────────────────── */

import React, { useState, useCallback } from 'react';
import {
  IonActionSheet,
  IonAlert,
  useIonToast,
} from '@ionic/react';
import { api } from '../services/api';
import type { ProfileViewDetailed } from '../types';

interface UserActionsSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  profile: ProfileViewDetailed;
  onUpdate?: () => void;
}

export default function UserActionsSheet({
  isOpen,
  onDismiss,
  profile,
  onUpdate,
}: UserActionsSheetProps) {
  const [present] = useIonToast();
  const [reportAlertOpen, setReportAlertOpen] = useState(false);

  const isMuted = !!profile.viewer?.muted;
  const isBlocked = !!profile.viewer?.blocking;

  const handleMute = useCallback(async () => {
    try {
      if (isMuted) {
        await api.unmuteActor(profile.did);
        present({
          message: `Unmuted @${profile.handle}`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      } else {
        await api.muteActor(profile.did);
        present({
          message: `Muted @${profile.handle}`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      }
      onUpdate?.();
    } catch (err) {
      present({
        message: `Failed: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
    }
  }, [isMuted, profile.did, profile.handle, present, onUpdate]);

  const handleBlock = useCallback(async () => {
    try {
      if (isBlocked) {
        await api.unblock(profile.viewer!.blocking!);
        present({
          message: `Unblocked @${profile.handle}`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      } else {
        await api.blockActor(profile.did);
        present({
          message: `Blocked @${profile.handle}`,
          duration: 2000,
          position: 'top',
          color: 'success',
        });
      }
      onUpdate?.();
    } catch (err) {
      present({
        message: `Failed: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
    }
  }, [isBlocked, profile.did, profile.handle, profile.viewer, present, onUpdate]);

  const handleReport = useCallback(
    async (reasonType: string) => {
      try {
        await api.reportAccount(profile.did, reasonType);
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
    [profile.did, present]
  );

  const buttons = [
    {
      text: isMuted ? 'Unmute' : 'Mute',
      handler: handleMute,
    },
    {
      text: isBlocked ? 'Unblock' : 'Block',
      role: isBlocked ? undefined : ('destructive' as const),
      handler: handleBlock,
    },
    {
      text: 'Report Account',
      role: 'destructive' as const,
      handler: () => {
        setTimeout(() => setReportAlertOpen(true), 200);
      },
    },
    {
      text: 'Copy Handle',
      handler: () => {
        navigator.clipboard.writeText(`@${profile.handle}`).then(() => {
          present({
            message: 'Handle copied',
            duration: 1500,
            position: 'top',
          });
        });
      },
    },
    {
      text: 'Copy DID',
      handler: () => {
        navigator.clipboard.writeText(profile.did).then(() => {
          present({
            message: 'DID copied',
            duration: 1500,
            position: 'top',
          });
        });
      },
    },
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
        header={`@${profile.handle}`}
        buttons={buttons}
      />

      <IonAlert
        isOpen={reportAlertOpen}
        onDidDismiss={() => setReportAlertOpen(false)}
        header="Report Account"
        message="Why are you reporting this account?"
        buttons={[
          {
            text: 'Spam',
            handler: () => handleReport('reasonSpam'),
          },
          {
            text: 'Misleading',
            handler: () => handleReport('reasonMisleading'),
          },
          {
            text: 'Violation',
            handler: () => handleReport('reasonViolation'),
          },
          {
            text: 'Other',
            handler: () => handleReport('reasonOther'),
          },
          {
            text: 'Cancel',
            role: 'cancel',
          },
        ]}
      />
    </>
  );
}
