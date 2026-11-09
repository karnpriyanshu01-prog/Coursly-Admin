'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Spinner } from './ui';

const OUT_W = 1280;
const OUT_H = 720; // 16:9, same shape as the poster in the app
const MAX_ZOOM = 4;

interface Props {
  /** The picked (or existing) image */
  source: Blob;
  onApply: (blob: Blob) => void;
  onClose: () => void;
}

/**
 * Crop / position / zoom a poster to 16:9.
 * What you see inside the frame is exactly what is saved (1280 x 720 WebP).
 */
export function PosterCropper({ source, onApply, onClose }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameW, setFrameW] = useState(480);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // image centre relative to frame centre (px)
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const frameH = (frameW * 9) / 16;

  useEffect(() => {
    setFrameW(Math.max(220, Math.min(480, window.innerWidth - 72)));
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(source);
    const el = new Image();
    el.onload = () => setImg(el);
    el.onerror = () => setError('Could not read this image. Try a different file.');
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [source]);

  /** Size of the image on screen for a zoom level (zoom 1 = just covers the frame). */
  const dims = useCallback(
    (z: number) => {
      if (!img) return { dw: frameW, dh: frameH };
      const base = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
      return { dw: img.naturalWidth * base * z, dh: img.naturalHeight * base * z };
    },
    [img, frameW, frameH],
  );

  /** Keep the image covering the whole frame (no empty edges). */
  const clamp = useCallback(
    (o: { x: number; y: number }, z: number) => {
      const { dw, dh } = dims(z);
      const mx = (dw - frameW) / 2;
      const my = (dh - frameH) / 2;
      return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
    },
    [dims, frameW, frameH],
  );

  const o = clamp(offset, zoom);
  const { dw, dh } = dims(zoom);

  function changeZoom(z: number) {
    setZoom(z);
    setOffset((cur) => clamp(cur, z));
  }

  async function apply() {
    if (!img || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser cannot process images.');
      ctx.imageSmoothingQuality = 'high';
      const k = OUT_W / frameW;
      ctx.drawImage(img, (frameW / 2 + o.x - dw / 2) * k, (frameH / 2 + o.y - dh / 2) * k, dw * k, dh * k);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
      if (!blob) throw new Error('Could not process this image.');
      onApply(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process this image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Adjust poster"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} loading={busy} disabled={!img}>
            Use this crop
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-[14px] text-danger">{error}</p>
      ) : !img ? (
        <div className="flex items-center justify-center gap-2 py-10 text-ink-muted">
          <Spinner /> Loading image...
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative select-none overflow-hidden rounded-lg border border-line bg-paper-warm"
            style={{ width: frameW, height: frameH, touchAction: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x;
              const dy = e.clientY - drag.current.y;
              drag.current = { x: e.clientX, y: e.clientY };
              setOffset((cur) => clamp({ x: cur.x + dx, y: cur.y + dy }, zoom));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                maxWidth: 'none',
                width: dw,
                height: dh,
                left: frameW / 2 + o.x - dw / 2,
                top: frameH / 2 + o.y - dh / 2,
              }}
            />
            {/* rule-of-thirds guide */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
            </div>
          </div>

          <p className="text-[12px] text-ink-muted">Drag the image to move it. Use the slider to zoom.</p>

          <div className="flex w-full max-w-[480px] items-center gap-3">
            <span className="text-[18px] leading-none text-ink-muted" aria-hidden="true">
              &minus;
            </span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              aria-label="Zoom"
              onChange={(e) => changeZoom(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-green-600"
            />
            <span className="text-[18px] leading-none text-ink-muted" aria-hidden="true">
              +
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOffset({ x: 0, y: 0 })}>
              Center
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Reset
            </Button>
          </div>

          <p className="text-[12px] text-ink-faint">Saved as 1280 &times; 720 (16:9), the same shape as in the app.</p>
        </div>
      )}
    </Modal>
  );
}
