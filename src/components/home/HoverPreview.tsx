'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion, previewFollow } from '@/design/motion';

export type PreviewImage = { slug: string; avif: string; webp: string };

type Props = {
  /** Images for the rows that have one. A row opts in with `data-preview-slug`. */
  previews: PreviewImage[];
  children: ReactNode;
  className?: string;
};

// The preview exists only for a mouse or trackpad. Touch screens never get it:
// a tap goes straight to the case page. The server snapshot is null, so the
// server render and the hydration pass agree (no preview, no data-preview);
// right after hydration React re-renders with the real answer.
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
function subscribeToPointer(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const readPointer = () => window.matchMedia(FINE_POINTER).matches;
const readServerPointer = () => null;

// The sticky site header (src/components/site/Header.tsx) marks itself with
// this attribute; the preview never rises behind it.
const SITE_HEADER = '[data-site-header]';

/**
 * Wraps the work index. On a fine pointer it shows the hovered project's
 * preview, which trails the cursor (lerp) and snaps to it under reduced motion.
 * Without JS, on touch, or before hydration it renders only its children.
 */
export function HoverPreview({ previews, children, className }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const fine = useSyncExternalStore<boolean | null>(
    subscribeToPointer,
    readPointer,
    readServerPointer,
  );

  return (
    <div
      ref={zoneRef}
      data-preview={fine === null ? undefined : fine ? 'on' : 'off'}
      className={className}
    >
      {children}
      {fine && <Preview zoneRef={zoneRef} previews={previews} />}
    </div>
  );
}

type Point = { x: number; y: number };

function Preview({
  zoneRef,
  previews,
}: {
  zoneRef: RefObject<HTMLDivElement | null>;
  previews: PreviewImage[];
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // `shown` stays set after the pointer leaves, so the image fades out instead
  // of vanishing; `open` drives the fade.
  const [shown, setShown] = useState<PreviewImage | null>(null);
  const [open, setOpen] = useState(false);
  const [warm, setWarm] = useState(false);

  // Fetch the images once the index is near the viewport, so they are cached
  // by the first hover without costing the first paint.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setWarm(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px 50% 0px' },
    );
    observer.observe(zone);
    return () => observer.disconnect();
  }, [zoneRef]);

  useEffect(() => {
    const zone = zoneRef.current;
    const anchor = anchorRef.current;
    const frame = frameRef.current;
    if (!zone || !anchor || !frame) return;

    const bySlug = new Map(previews.map((preview) => [preview.slug, preview]));
    let active: string | null = null;
    let reduced = false;
    let pointer: Point = { x: 0, y: 0 };
    let target: Point = { x: 0, y: 0 };
    let current: Point = { x: 0, y: 0 };
    let raf = 0;
    let lastFrame = 0;
    // The frame's box relative to the anchor, which sits on the pointer. CSS
    // places the frame up and to the right of it (--space-l above, --space-s
    // across), clear of the row under the pointer. `ceiling` is the highest
    // the frame may go: the bottom of the sticky site header, which would
    // cover it, plus the same --space-l clearance it keeps from the pointer.
    let box: {
      left: number;
      top: number;
      width: number;
      height: number;
      ceiling: number;
    } | null = null;

    const measure = () => {
      const header = document.querySelector(SITE_HEADER);
      // Vertical gap between the pointer and the frame's bottom edge: the
      // `bottom-l` offset, i.e. --space-l resolved to pixels.
      const clearance = -(frame.offsetTop + frame.offsetHeight);
      box = {
        left: frame.offsetLeft,
        top: frame.offsetTop,
        width: frame.offsetWidth,
        height: frame.offsetHeight,
        ceiling: (header?.getBoundingClientRect().bottom ?? 0) + clearance,
      };
      return box;
    };

    // Where the anchor should go so the frame stays fully in view: clamped to
    // the side edges (one --space-s in), and mirrored below the pointer when
    // there is no room above it.
    const aim = () => {
      const { left, top, width, height, ceiling } = box ?? measure();
      const margin = left;
      const viewportWidth = document.documentElement.clientWidth;
      const frameLeft = Math.max(
        margin,
        Math.min(pointer.x + left, viewportWidth - margin - width),
      );
      let frameTop = pointer.y + top;
      if (frameTop < ceiling) frameTop = pointer.y - top - height;
      target = { x: frameLeft - left, y: frameTop - top };
    };

    // Transform only: no layout, and it never touches React state.
    const paint = () => {
      anchor.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
    };

    const tick = (now: number) => {
      // previewFollow.lerp is the share of the remaining distance covered per
      // 60 fps frame; scale it by the real frame time so 120 Hz screens feel
      // the same. The cap keeps a stalled tab from overshooting.
      const frames = Math.min(now - lastFrame, 100) / (1000 / 60);
      lastFrame = now;
      const t = 1 - Math.pow(1 - previewFollow.lerp, frames);
      current = {
        x: current.x + (target.x - current.x) * t,
        y: current.y + (target.y - current.y) * t,
      };
      const settled =
        Math.abs(target.x - current.x) < 0.1 && Math.abs(target.y - current.y) < 0.1;
      if (settled) current = target;
      paint();
      raf = settled ? 0 : requestAnimationFrame(tick);
    };

    const follow = () => {
      aim();
      if (reduced) {
        current = target;
        paint();
        return;
      }
      if (!raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const show = (slug: string) => {
      if (slug === active) return;
      if (active === null) {
        // Opening: appear at the pointer, then trail it. Reading the media
        // query here picks up a change made since the last hover.
        reduced = prefersReducedMotion();
        measure();
        aim();
        current = target;
        paint();
      }
      active = slug;
      setShown(bySlug.get(slug) ?? null);
      setOpen(true);
    };

    const hide = () => {
      if (active === null) return;
      active = null;
      setOpen(false);
    };

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      const row = (event.target as Element).closest<HTMLElement>('[data-preview-slug]');
      const slug = row?.dataset.previewSlug;
      if (slug && bySlug.has(slug)) {
        show(slug);
        follow();
      } else {
        // Gaps, the Yokaido row (no preview, ruling R12) and anything else.
        hide();
      }
    };
    const onResize = () => {
      box = null;
    };

    // pointerover also fires when a scroll moves a new row under a still cursor.
    zone.addEventListener('pointerover', onPointer);
    zone.addEventListener('pointermove', onPointer);
    zone.addEventListener('pointerleave', hide);
    // Never come back from the back/forward cache with a stale preview open.
    window.addEventListener('pagehide', hide);
    window.addEventListener('resize', onResize);
    return () => {
      zone.removeEventListener('pointerover', onPointer);
      zone.removeEventListener('pointermove', onPointer);
      zone.removeEventListener('pointerleave', hide);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [zoneRef, previews]);

  return (
    <>
      {/* Portalled to <body>: a transformed ancestor (a scroll reveal, a page
          transition) would otherwise become the containing block of this
          fixed element and offset it from the cursor. */}
      {createPortal(
        <div
          ref={anchorRef}
          data-testid="hover-preview"
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0"
        >
          {/* Fades and settles in from the corner nearest the cursor. Ruling
              R13: discrete visibility flip allowed; not interpolated. It
              flips to hidden only when the fade ends, so a closed preview is
              truly hidden (opacity 0 alone still counts as visible). The
              16/10 box matches the 1600x1000 previews exported by
              scripts/optimize-images.mjs, so it never resizes while loading. */}
          <div
            ref={frameRef}
            data-state={open ? 'open' : 'closed'}
            className="absolute bottom-l left-s aspect-[16/10] w-preview origin-bottom-left overflow-hidden border border-rule bg-paper transition-[opacity,scale,visibility] data-[state=closed]:invisible data-[state=closed]:opacity-0 motion-safe:data-[state=closed]:scale-96"
          >
            {shown && (
              <picture key={shown.slug}>
                <source type="image/avif" srcSet={shown.avif} />
                <img
                  src={shown.webp}
                  alt=""
                  width={1600}
                  height={1000}
                  className="block size-full object-cover"
                />
              </picture>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Warm-up copies: the browser picks AVIF or WebP and caches it. */}
      {warm && (
        <div hidden>
          {previews.map((preview) => (
            <picture key={preview.slug}>
              <source type="image/avif" srcSet={preview.avif} />
              <img src={preview.webp} alt="" width={1600} height={1000} />
            </picture>
          ))}
        </div>
      )}
    </>
  );
}
