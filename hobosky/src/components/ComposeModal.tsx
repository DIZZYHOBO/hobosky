/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Compose Modal Component
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
  IonProgressBar,
  useIonToast,
} from '@ionic/react';
import {
  closeOutline,
  imageOutline,
  videocamOutline,
} from 'ionicons/icons';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_AVATAR } from '../utils';
import type { StrongRef, BlobRef } from '../types';

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
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export default function ComposeModal({
  isOpen,
  onDismiss,
  replyTo,
  onSuccess,
}: ComposeModalProps) {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<BlobRef | null>(null);
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [present] = useIonToast();

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const hasMedia = images.length > 0 || videoFile !== null;
  const canPost =
    text.trim().length > 0 && !isOverLimit && !posting && !videoUploading;

  const handlePost = useCallback(async () => {
    if (!canPost || !session) return;

    setPosting(true);
    try {
      let embed = undefined;

      // Image embed
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

      // Video embed
      if (videoBlob) {
        embed = {
          $type: 'app.bsky.embed.video',
          video: videoBlob,
          alt: '',
        };
      }

      const facets = api.detectFacets(text);

      let reply = undefined;
      if (replyTo) {
        const root = replyTo.root || {
          uri: replyTo.uri,
          cid: replyTo.cid,
        };
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
      clearVideo();
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
  }, [
    canPost,
    session,
    text,
    images,
    videoBlob,
    replyTo,
    onDismiss,
    onSuccess,
    present,
  ]);

  const handleImageSelect = useCallback(() => {
    if (images.length >= MAX_IMAGES || videoFile) return;
    fileInputRef.current?.click();
  }, [images.length, videoFile]);

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

  // ── Video Upload ────────────────────────────────────

  const handleVideoSelect = useCallback(() => {
    if (images.length > 0 || videoFile) return;
    videoInputRef.current?.click();
  }, [images.length, videoFile]);

  const handleVideoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      if (file.size > MAX_VIDEO_SIZE) {
        present({
          message: 'Video must be under 50MB',
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        return;
      }

      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setVideoUploading(true);
      setVideoProgress(0);

      try {
        // Check upload limits first
        const limits = await api.getVideoUploadLimits();
        if (!limits.canUpload) {
          present({
            message:
              limits.message || 'Video upload limit reached. Try again later.',
            duration: 3000,
            position: 'top',
            color: 'warning',
          });
          clearVideo();
          return;
        }

        // Upload video
        setVideoProgress(0.1);
        const uploadRes = await api.uploadVideo(file);
        setVideoProgress(0.5);

        // Poll for job completion
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes at 1s intervals

        const pollStatus = async (): Promise<BlobRef | null> => {
          while (attempts < maxAttempts) {
            attempts++;
            const statusRes = await api.getVideoJobStatus(
              uploadRes.jobId
            );
            const status = statusRes.jobStatus;

            if (status.state === 'JOB_STATE_COMPLETED' && status.blob) {
              setVideoProgress(1);
              return status.blob;
            }

            if (status.state === 'JOB_STATE_FAILED') {
              throw new Error(
                status.error || 'Video processing failed'
              );
            }

            // Update progress
            const progress =
              0.5 + (status.progress ?? 0) * 0.5;
            setVideoProgress(Math.min(progress, 0.95));

            // Wait 1 second before polling again
            await new Promise((r) => setTimeout(r, 1000));
          }
          throw new Error('Video processing timed out');
        };

        const blob = await pollStatus();
        if (blob) {
          setVideoBlob(blob);
          present({
            message: 'Video ready!',
            duration: 1500,
            position: 'top',
            color: 'success',
          });
        }
      } catch (err) {
        present({
          message: `Video upload failed: ${(err as Error).message}`,
          duration: 3000,
          position: 'top',
          color: 'danger',
        });
        clearVideo();
      } finally {
        setVideoUploading(false);
      }
    },
    [present]
  );

  const clearVideo = useCallback(() => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoBlob(null);
    setVideoUploading(false);
    setVideoProgress(0);
  }, [videoPreviewUrl]);

  const handleModalDidPresent = useCallback(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleDismiss = useCallback(() => {
    setText('');
    setImages([]);
    clearVideo();
    onDismiss();
  }, [onDismiss, clearVideo]);

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
          <IonTitle
            style={{
              fontFamily: 'Outfit',
              fontWeight: 700,
              fontSize: 17,
            }}
          >
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
              {posting ? (
                <IonSpinner
                  name="crescent"
                  style={{ width: 18, height: 18 }}
                />
              ) : (
                'Post'
              )}
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
          <img className="post-avatar" src={DEFAULT_AVATAR} alt="" />
          <textarea
            ref={textareaRef}
            className="compose-textarea"
            placeholder={
              replyTo ? 'Post your reply...' : "What's happening?"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height =
                Math.max(120, el.scrollHeight) + 'px';
            }}
          />
        </div>

        {/* Image previews */}
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

        {/* Video preview */}
        {videoPreviewUrl && (
          <div style={{ padding: '0 16px', marginTop: 8 }}>
            <div
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid var(--hb-border)',
              }}
            >
              <video
                src={videoPreviewUrl}
                style={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'cover',
                  opacity: videoUploading ? 0.6 : 1,
                }}
                muted
              />
              {videoUploading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.5)',
                    gap: 8,
                  }}
                >
                  <IonSpinner name="crescent" />
                  <span
                    style={{
                      fontSize: 12,
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    Processing video...{' '}
                    {Math.round(videoProgress * 100)}%
                  </span>
                </div>
              )}
              {!videoUploading && videoBlob && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    padding: '2px 8px',
                    background: 'rgba(34, 197, 94, 0.9)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  Ready
                </div>
              )}
              <button
                className="compose-image-remove"
                onClick={clearVideo}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                }}
              >
                ✕
              </button>
            </div>
            {videoUploading && (
              <IonProgressBar
                value={videoProgress}
                style={{ marginTop: 4, borderRadius: 4 }}
              />
            )}
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
          disabled={images.length >= MAX_IMAGES || !!videoFile}
          style={{
            opacity:
              images.length >= MAX_IMAGES || !!videoFile ? 0.4 : 1,
          }}
        >
          <IonIcon icon={imageOutline} />
        </button>
        <button
          className="compose-toolbar-btn"
          onClick={handleVideoSelect}
          disabled={images.length > 0 || !!videoFile}
          style={{
            opacity:
              images.length > 0 || !!videoFile ? 0.4 : 1,
          }}
        >
          <IonIcon icon={videocamOutline} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={handleFileChange}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          hidden
          onChange={handleVideoChange}
        />
      </div>
    </IonModal>
  );
}
