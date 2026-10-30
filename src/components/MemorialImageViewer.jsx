import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import personPlaceholder from '../assets/person-placeholder.svg';
import styles from './MemorialImageViewer.module.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
const distanceBetween = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

export default function MemorialImageViewer({ images, index, onNavigate, onClose }) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ distance: 0, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const scaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const closeTimerRef = useRef(null);
  const callbacksRef = useRef({ onNavigate, onClose, index, imageCount: images.length });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [fitSize, setFitSize] = useState({ width: 0, height: 0 });
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);

  const activeImage = images[index];
  useEffect(() => {
    callbacksRef.current = { onNavigate, onClose, index, imageCount: images.length };
  }, [onNavigate, onClose, index, images.length]);

  const recalculateFit = useCallback(() => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image?.naturalWidth || !image?.naturalHeight) return;
    const fit = Math.min(stage.clientWidth / image.naturalWidth, stage.clientHeight / image.naturalHeight);
    const next = { width: image.naturalWidth * fit, height: image.naturalHeight * fit };
    setFitSize((current) => (
      Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5
        ? current
        : next
    ));
  }, []);

  const fitDimensions = useCallback(() => fitSize, [fitSize]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    recalculateFit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalculateFit) : null;
    observer?.observe(stage);
    window.addEventListener('resize', recalculateFit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', recalculateFit);
    };
  }, [recalculateFit]);

  const constrainPosition = useCallback((next, zoom = scaleRef.current) => {
    const stage = stageRef.current;
    const base = fitDimensions();
    if (!stage || !base.width || !base.height) return next;
    const maxX = Math.max(0, (base.width * zoom - stage.clientWidth) / 2);
    const maxY = Math.max(0, (base.height * zoom - stage.clientHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, [fitDimensions]);

  const applyZoom = useCallback((nextZoom) => {
    const boundedZoom = clampZoom(nextZoom);
    scaleRef.current = boundedZoom;
    setScale(boundedZoom);
    const nextPosition = boundedZoom === MIN_ZOOM
      ? { x: 0, y: 0 }
      : constrainPosition(positionRef.current, boundedZoom);
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, [constrainPosition]);

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => callbacksRef.current.onClose(), 170);
  }, []);

  const navigateTo = useCallback((nextIndex) => {
    resetZoom();
    pointersRef.current.clear();
    callbacksRef.current.onNavigate(nextIndex);
  }, [resetZoom]);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      bodyOverflow: body.style.overflow,
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
      rootTouchAction: root.style.touchAction,
    };

    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    root.style.touchAction = 'none';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') requestClose();
      const { imageCount, index: currentIndex } = callbacksRef.current;
      if (imageCount > 1 && event.key === 'ArrowLeft') navigateTo((currentIndex - 1 + imageCount) % imageCount);
      if (imageCount > 1 && event.key === 'ArrowRight') navigateTo((currentIndex + 1) % imageCount);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previous.bodyOverflow;
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscrollBehavior;
      root.style.touchAction = previous.rootTouchAction;
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [navigateTo, requestClose]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        distance: 0,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
      };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      gestureRef.current.distance = distanceBetween(first, second);
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = Array.from(pointersRef.current.values());

    if (pointers.length >= 2) {
      const nextDistance = distanceBetween(pointers[0], pointers[1]);
      const previousDistance = gestureRef.current.distance;
      if (previousDistance > 0) applyZoom(scaleRef.current * (nextDistance / previousDistance));
      gestureRef.current.distance = nextDistance;
      gestureRef.current.moved = true;
      return;
    }

    const pointer = pointers[0];
    const deltaX = pointer.x - gestureRef.current.lastX;
    const deltaY = pointer.y - gestureRef.current.lastY;
    if (Math.abs(pointer.x - gestureRef.current.startX) > 6 || Math.abs(pointer.y - gestureRef.current.startY) > 6) {
      gestureRef.current.moved = true;
    }
    if (scaleRef.current > 1) {
      const nextPosition = constrainPosition({
        x: positionRef.current.x + deltaX,
        y: positionRef.current.y + deltaY,
      });
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    }
    gestureRef.current.lastX = pointer.x;
    gestureRef.current.lastY = pointer.y;
  };

  const handlePointerUp = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    const deltaX = event.clientX - gestureRef.current.startX;
    const deltaY = event.clientY - gestureRef.current.startY;
    if (scaleRef.current === 1 && callbacksRef.current.imageCount > 1 && Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const { index: currentIndex, imageCount } = callbacksRef.current;
      navigateTo((currentIndex + (deltaX < 0 ? 1 : -1) + imageCount) % imageCount);
    } else if (scaleRef.current === 1 && deltaY > 110 && deltaY > Math.abs(deltaX)) {
      requestClose();
    }

    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      gestureRef.current.lastX = remaining.x;
      gestureRef.current.lastY = remaining.y;
      gestureRef.current.startX = remaining.x;
      gestureRef.current.startY = remaining.y;
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    applyZoom(scaleRef.current + (event.deltaY < 0 ? 0.2 : -0.2));
  };

  if (!activeImage) return null;

  return (
    <div
      className={`${styles.viewer} ${isClosing ? styles.viewerClosing : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de fotografias"
      onClick={requestClose}
    >
      <button type="button" className={styles.closeButton} onClick={requestClose} aria-label="Fechar visualizador">
        <X size={22} />
      </button>

      <div className={styles.zoomControls} onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => applyZoom(scaleRef.current + 0.5)} aria-label="Aumentar zoom" disabled={scale >= MAX_ZOOM}>
          <ZoomIn size={18} /><span>+</span>
        </button>
        <button type="button" onClick={() => applyZoom(scaleRef.current - 0.5)} aria-label="Diminuir zoom" disabled={scale <= MIN_ZOOM}>
          <ZoomOut size={18} /><span>−</span>
        </button>
        <button type="button" onClick={resetZoom} aria-label="Restaurar zoom" disabled={scale === MIN_ZOOM}>
          <RotateCcw size={17} />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button type="button" className={`${styles.navButton} ${styles.previousButton}`} onClick={(event) => { event.stopPropagation(); navigateTo((index - 1 + images.length) % images.length); }} aria-label="Foto anterior">
            <ChevronLeft size={26} />
          </button>
          <button type="button" className={`${styles.navButton} ${styles.nextButton}`} onClick={(event) => { event.stopPropagation(); navigateTo((index + 1) % images.length); }} aria-label="Próxima foto">
            <ChevronRight size={26} />
          </button>
        </>
      )}

      <div
        ref={stageRef}
        className={`${styles.stage} ${scale > 1 ? styles.stageZoomed : ''}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => pointersRef.current.delete(event.pointerId)}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          className={styles.image}
          src={activeImage.src || personPlaceholder}
          alt={activeImage.caption || 'Fotografia do memorial'}
          draggable="false"
          onLoad={recalculateFit}
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }}
          style={{
            width: fitSize.width ? `${fitSize.width}px` : undefined,
            height: fitSize.height ? `${fitSize.height}px` : undefined,
            transform: `translate(-50%, -50%) translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          }}
        />
      </div>

      <div className={styles.caption} onClick={(event) => event.stopPropagation()}>
        <p>{activeImage.caption}</p>
        {images.length > 1 && <span>{index + 1} de {images.length}</span>}
      </div>
      <span className={styles.gestureHint} aria-hidden="true">Pinça para ampliar · Arraste para mover</span>
    </div>
  );
}
