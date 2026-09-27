import { useEffect, useRef } from "react";

interface Props {
  totalFrames?: number;
  onEnterApp: () => void;
  onGuestLogin?: () => void;
}

export function CinematicFrameSequence({
  totalFrames = 240,
  onEnterApp,
  onGuestLogin,
}: Props) {

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  const imagesRef = useRef<(HTMLImageElement | null)[]>(
    new Array(totalFrames + 1).fill(null),
  );
  const loadedSetRef = useRef<Set<number>>(new Set());
  const lastDrawnIndexRef = useRef<number>(-1);
  const targetProgressRef = useRef<number>(0);
  const isReducedMotionRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  function getFramePath(index: number): string {
    const padded = String(index).padStart(3, "0");
    return `/ezgif-frame-${padded}.jpg`;
  }

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    img: HTMLImageElement,
  ) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth || 1920;
    const imgHeight = img.naturalHeight || 1080;

    // Aspect-ratio cover calculation: centers and covers without stretching
    const hRatio = canvasWidth / imgWidth;
    const vRatio = canvasHeight / imgHeight;
    const ratio = Math.max(hRatio, vRatio);

    const drawWidth = imgWidth * ratio;
    const drawHeight = imgHeight * ratio;

    const shiftX = (canvasWidth - drawWidth) / 2;
    const shiftY = (canvasHeight - drawHeight) / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(
      img,
      0,
      0,
      imgWidth,
      imgHeight,
      shiftX,
      shiftY,
      drawWidth,
      drawHeight,
    );
  }

  function resizeCanvas(canvas: HTMLCanvasElement): boolean {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      return true;
    }
    return false;
  }

  function getBestAvailableImage(
    targetIndex: number,
  ): HTMLImageElement | null {
    const images = imagesRef.current;
    if (images[targetIndex]) return images[targetIndex];

    // Search backward first for the closest previous loaded frame
    for (let i = targetIndex - 1; i >= 1; i--) {
      if (images[i]) return images[i];
    }
    // Search forward if no previous loaded frame exists
    for (let i = targetIndex + 1; i <= totalFrames; i++) {
      if (images[i]) return images[i];
    }
    return null;
  }

  useEffect(() => {
    let cancelled = false;
    const images = imagesRef.current;
    const loadedSet = loadedSetRef.current;

    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    isReducedMotionRef.current = motionQuery.matches;

    if (isReducedMotionRef.current) {
      // In reduced motion mode, load the final landmark frame directly
      const finalImg = new Image();
      finalImg.src = getFramePath(totalFrames);
      finalImg.onload = () => {
        if (cancelled || !canvasRef.current) return;
        images[totalFrames] = finalImg;
        loadedSet.add(totalFrames);
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          resizeCanvas(canvasRef.current);
          drawFrame(ctx, canvasRef.current, finalImg);
          lastDrawnIndexRef.current = totalFrames;
        }
      };
      return () => {
        cancelled = true;
      };
    }

    // Step 1: Immediately load Frame 1 and the final landmark Frame
    function loadSingleFrame(index: number, priority = false): void {
      if (loadedSet.has(index) || images[index]) return;
      const img = new Image();
      images[index] = img; // mark in-flight
      img.src = getFramePath(index);
      img.onload = () => {
        if (cancelled) return;
        loadedSet.add(index);
        // Redraw if this was the frame we were waiting for
        const currentTarget = Math.min(
          totalFrames,
          Math.max(1, Math.round(1 + targetProgressRef.current * (totalFrames - 1))),
        );
        if (Math.abs(currentTarget - index) <= 2 || index === 1) {
          scheduleRender();
        }
      };
      img.onerror = () => {
        images[index] = null;
      };
    }

    // Load Frame 1 immediately
    const img1 = new Image();
    img1.src = getFramePath(1);
    img1.onload = () => {
      if (cancelled) return;
      images[1] = img1;
      loadedSet.add(1);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          resizeCanvas(canvasRef.current);
          drawFrame(ctx, canvasRef.current, img1);
          lastDrawnIndexRef.current = 1;
        }
      }
      // Preload final frame for instant reveal at end of sequence
      loadSingleFrame(totalFrames);
      startBackgroundPreload();
    };
    img1.onerror = () => {
      if (cancelled) return;
      loadSingleFrame(totalFrames);
      startBackgroundPreload();
    };

    // Step 2: Background preload queue with concurrency limit
    let nextFrameToLoad = 2;
    const MAX_CONCURRENT = 5;
    let activeLoads = 0;

    function startBackgroundPreload() {
      pumpQueue();
    }

    function pumpQueue() {
      if (cancelled) return;
      while (activeLoads < MAX_CONCURRENT && nextFrameToLoad <= totalFrames) {
        const index = nextFrameToLoad++;
        if (loadedSet.has(index)) continue;
        activeLoads++;
        const img = new Image();
        images[index] = img;
        img.src = getFramePath(index);
        img.onload = () => {
          activeLoads--;
          if (!cancelled) {
            loadedSet.add(index);
            scheduleRender();
            pumpQueue();
          }
        };
        img.onerror = () => {
          activeLoads--;
          images[index] = null;
          if (!cancelled) {
            pumpQueue();
          }
        };
      }
    }

    function scheduleRender() {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(render);
    }

    function updateScrollProgress() {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const maxScroll = rect.height - window.innerHeight;
      if (maxScroll <= 0) {
        targetProgressRef.current = 0;
      } else {
        const scrolled = -rect.top;
        const progress = Math.min(Math.max(scrolled / maxScroll, 0), 1);
        targetProgressRef.current = progress;
      }
      scheduleRender();
    }

    function render() {
      rafIdRef.current = null;
      if (cancelled || isReducedMotionRef.current) return;

      const progress = targetProgressRef.current;
      const targetFrame = Math.min(
        totalFrames,
        Math.max(1, Math.round(1 + progress * (totalFrames - 1))),
      );

      // Draw canvas if target frame changed or dimensions changed
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          const resized = resizeCanvas(canvasRef.current);
          if (targetFrame !== lastDrawnIndexRef.current || resized) {
            if (!loadedSet.has(targetFrame)) {
              loadSingleFrame(targetFrame);
            }
            const img = getBestAvailableImage(targetFrame);
            if (img) {
              drawFrame(ctx, canvasRef.current, img);
              lastDrawnIndexRef.current = targetFrame;
            }
          }
        }
      }

      // Update Intro overlay without React re-renders:
      // Visible 0..0.08, fades out by 0.22, drifts slightly up
      const introOpacity =
        progress < 0.08
          ? 1
          : Math.max(0, 1 - (progress - 0.08) / 0.14);
      const introY = (1 - introOpacity) * -24;
      if (introRef.current) {
        introRef.current.style.opacity = introOpacity.toFixed(3);
        introRef.current.style.transform = `translate3d(0, ${introY.toFixed(1)}px, 0)`;
      }

      // Scroll hint fades out rapidly on first scroll
      if (scrollHintRef.current) {
        const hintOpacity = Math.max(0, 1 - progress / 0.04);
        scrollHintRef.current.style.opacity = hintOpacity.toFixed(3);
      }

      // Update Outro overlay:
      // Fades in at 0.84, fully visible by 0.94, rises gently up into place
      const outroOpacity =
        progress < 0.84 ? 0 : Math.min(1, (progress - 0.84) / 0.1);
      const outroY = (1 - outroOpacity) * 24;
      if (outroRef.current) {
        outroRef.current.style.opacity = outroOpacity.toFixed(3);
        outroRef.current.style.transform = `translate3d(0, ${outroY.toFixed(1)}px, 0)`;
        outroRef.current.style.pointerEvents =
          outroOpacity > 0.5 ? "auto" : "none";
      }
    }

    // Initial measurement
    updateScrollProgress();

    // Passive scroll and resize listeners
    window.addEventListener("scroll", updateScrollProgress, {
      passive: true,
    });
    window.addEventListener("resize", updateScrollProgress, {
      passive: true,
    });

    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, [totalFrames]);

  return (
    <section
      ref={sectionRef}
      className="cinematic-section"
      aria-label="Aakaro Cinematic Brand Transformation"
    >
      <div className="cinematic-sticky-stage">
        <canvas ref={canvasRef} className="cinematic-canvas" />
        <div className="cinematic-vignette" />

        {/* Hero Intro Overlay */}
        <div ref={introRef} className="cinematic-overlay cinematic-intro">
          <h1 className="cinematic-title">AAKARO</h1>
          <p className="cinematic-tagline">Give your idea an identity.</p>
          {onGuestLogin && (
            <div className="cinematic-hero-actions">
              <button
                type="button"
                className="cinematic-guest-btn"
                onClick={onGuestLogin}
                aria-label="Guest sign in"
              >
                <span>Guest Sign In · Quick Access</span>
                <svg
                  className="cinematic-cta-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}
          <div
            ref={scrollHintRef}
            className="cinematic-scroll-hint"
            aria-hidden="true"
          >
            <span>Scroll to explore</span>
            <div className="cinematic-scroll-indicator" />
          </div>
        </div>

        {/* Final Landmark Reveal & CTA Overlay */}
        <div ref={outroRef} className="cinematic-overlay cinematic-outro">
          <h2 className="cinematic-final-title">AAKARO</h2>
          <p className="cinematic-final-tagline">
            Give your idea an identity.
          </p>
          <div className="cinematic-cta-group">
            <button
              type="button"
              className="cinematic-cta-button"
              onClick={onEnterApp}
              aria-label="Enter Aakaro"
            >
              <span>Enter Aakaro</span>
              <svg
                className="cinematic-cta-icon"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {onGuestLogin && (
              <button
                type="button"
                className="cinematic-cta-button cinematic-cta-secondary"
                onClick={onGuestLogin}
                aria-label="Continue as guest"
              >
                <span>Continue as Guest</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>

  );
}
