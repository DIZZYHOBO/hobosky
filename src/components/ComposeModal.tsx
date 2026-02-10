/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Compose Modal Component
   ────────────────────────────────────────────────────────── */

import React, { useState, useRef, useCallback } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonTitle,
  useIonToast,
} from '@ionic/react';
import { closeOutline, imageOutline } from 'ionicons/icons';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_AVATAR } from '../utils';
import type { StrongRef } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  replyTo?: {
    uri: string;
    cid: string;
    root?: StrongRef;
    author?: { handle: string; displayName?: string };
    text?: string;
  };
  onSuccess?: () => void;
}

interface ImagePreview {
  file: File;
  url: string;
}

const MAX_CHARS = 300;
const MAX_IMAGES = 4;

export default function ComposeModal({
  isOpen,
  onDismiss,
  replyTo,
  onSuccess,
}: ComposeModalProps) {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [present] = useIonToast();

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canPost = text.trim().length > 0 && !isOverLimit && !posting;

  const handlePost = useCallback(async () => {
    if (!canPost || !session) return;

    setPosting(true);
    try {
      // Upload images if any
      let embed = undefined;
      if (images.length > 0) {
        const uploadedImages = [];
        for (const img of images) {
          const res = await api.uploadBlob(img.file);
          uploadedImages.push({
            alt: '',
            image: res.blob,
          });
        }
        embed = {
          $type: 'app.bsky.embed.images',
          images: uploadedImages,
        };
      }

      // Detect facets
      const facets = api.detectFacets(text);

      // Build reply ref
      let reply = undefined;
      if (replyTo) {
        const root = replyTo.root || { uri: replyTo.uri, cid: replyTo.cid };
        reply = {
          root,
          parent: { uri: replyTo.uri, cid: replyTo.cid },
        };
      }

      await api.createPost(text, {
        reply,
        embed,
        facets: facets.length > 0 ? facets : undefined,
      });

      setText('');
      setImages([]);
      onDismiss();
      onSuccess?.();

      present({
        message: replyTo ? 'Reply posted!' : 'Post published!',
        duration: 2000,
        position: 'top',
        color: 'success',
      });
    } catch (err) {
      present({
        message: `Failed to post: ${(err as Error).message}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      });
    } finally {
      setPosting(false);
    }
  }, [canPost, session, text, images, replyTo, onDismiss, onSuccess, present]);

  const handleImageSelect = useCallback(() => {
    if (images.length >= MAX_IMAGES) return;
    fileInputRef.current?.click();
  }, [images.length]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);

      const newPreviews = toAdd.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
      }));

      setImages((prev) => [...prev, ...newPreviews]);
      e.target.value = '';
    },
    [images.length]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleModalDidPresent = useCallback(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleDismiss = useCallback(() => {
    setText('');
    setImages([]);
    onDismiss();
  }, [onDismiss]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleDismiss}
      onDidPresent={handleModalDidPresent}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17 }}>
            {replyTo ? 'Reply' : 'New Post'}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton
              color="primary"
              fill="solid"
              disabled={!canPost}
              onClick={handlePost}
              style={{ borderRadius: 20, minHeight: 34, fontSize: 14 }}
            >
              {posting ? <IonSpinner name="crescent" style={{ width: 18, height: 18 }} /> : 'Post'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {replyTo?.author && (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--hb-border)',
              fontSize: 13,
              color: 'var(--hb-text-muted)',
            }}
          >
            Replying to{' '}
            <span style={{ color: 'var(--hb-accent)' }}>
              @{replyTo.author.handle}
            </span>
            {replyTo.text && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: 'var(--hb-text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {replyTo.text}
              </div>
            )}
          </div>
        )}

        <div className="compose-container">
          <img
            className="post-avatar"
            src={DEFAULT_AVATAR}
            alt=""
          />
          <textarea
            ref={textareaRef}
            className="compose-textarea"
            placeholder={replyTo ? 'Post your reply...' : "What's happening?"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.max(120, el.scrollHeight) + 'px';
            }}
          />
        </div>

        {images.length > 0 && (
          <div className="compose-image-previews">
            {images.map((img, i) => (
              <div key={i} className="compose-image-preview">
                <img src={img.url} alt="" />
                <button
                  className="compose-image-remove"
                  onClick={() => removeImage(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`compose-char-count ${
            charCount > MAX_CHARS * 0.9
              ? isOverLimit
                ? 'over'
                : 'warning'
              : ''
          }`}
        >
          {charCount}/{MAX_CHARS}
        </div>
      </div>

      <div className="compose-toolbar">
        <button
          className="compose-toolbar-btn"
          onClick={handleImageSelect}
          disabled={images.length >= MAX_IMAGES}
          style={{ opacity: images.length >= MAX_IMAGES ? 0.4 : 1 }}
        >
          <IonIcon icon={imageOutline} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>
    </IonModal>
  );
}
