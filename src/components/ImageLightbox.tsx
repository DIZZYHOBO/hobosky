/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Image Lightbox Component
   ────────────────────────────────────────────────────────── */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { closeOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

interface LightboxImage {
  thumb: string;
  fullsize: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageLightbox({
  images,
  initialIndex,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };

    document.addEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    };
  }, [isOpen, currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((i) => i + 1);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex, images.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) return;

      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      // Quick swipe detection
      if (elapsed < 300 && Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && scale === 1) {
        if (deltaX > 0) goToPrev();
        else goToNext();
        return;
      }

      // Tap to close (small movement, quick)
      if (elapsed < 200 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        onClose();
      }
    },
    [goToPrev, goToNext, onClose, scale]
  );

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  }, [scale]);

  if (!isOpen || images.length === 0) return null;

  const current = images[currentIndex];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        <IonIcon icon={closeOutline} style={{ fontSize: 24 }} />
      </button>

      {/* Image counter */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            fontSize: 14,
            fontFamily: 'Outfit',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.8)',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '4px 14px',
            borderRadius: 20,
            backdropFilter: 'blur(8px)',
          }}
        >
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Nav arrows (desktop) */}
      {images.length > 1 && currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          style={{
            position: 'absolute',
            left: 16,
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <IonIcon icon={chevronBackOutline} style={{ fontSize: 22 }} />
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          style={{
            position: 'absolute',
            right: 16,
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <IonIcon icon={chevronForwardOutline} style={{ fontSize: 22 }} />
        </button>
      )}

      {/* Main image */}
      <img
        src={current.fullsize}
        alt={current.alt || ''}
        onDoubleClick={handleDoubleClick}
        style={{
          maxWidth: '95vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
          transition: scale === 1 ? 'transform 0.25s ease' : 'none',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        draggable={false}
      />

      {/* Alt text */}
      {current.alt && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '80vw',
            padding: '8px 16px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 10,
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
            lineHeight: 1.4,
          }}
        >
          {current.alt}
        </div>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: current.alt ? 60 : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
          }}
        >
          {images.map((_, i) => (
            <div
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background:
                  i === currentIndex
                    ? '#fff'
                    : 'rgba(255, 255, 255, 0.35)',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
