/**
 * Shared pointer controls for visualizers with a camera.
 *
 * Every visualizer that let you orbit had grown its own mouse/touch wiring,
 * and most of them only ever read `touches[0]` — so a two-finger pinch on a
 * phone was treated as a one-finger drag and zoom was unreachable. This
 * centralises the gesture handling: drag to orbit, wheel or pinch to zoom.
 */

/**
 * Pinch distances are in pixels; wheel deltas are not. This scales a pinch
 * into the same range so a visualizer can feed both into the one zoom mapping
 * it already uses for the wheel.
 */
const PINCH_TO_WHEEL = 5;

export interface PointerControlOptions {
  /** One finger or the mouse. Deltas are in pixels. */
  onDrag?: (dx: number, dy: number) => void;
  /** A drag began — visualizers use this to pause their idle auto-rotation. */
  onDragStart?: () => void;
  /** The drag ended, or a second finger took over for a pinch. */
  onDragEnd?: () => void;
  /**
   * Zoom, signed like wheel `deltaY`: positive pulls the camera back, negative
   * pushes it in. Pinching apart sends negative, together positive.
   */
  onZoom?: (delta: number) => void;
  /** Show grab / grabbing cursors while dragging. Off by default. */
  cursor?: boolean;
}

/** Wires the gestures up and returns a function that removes every listener. */
export function attachPointerControls(
  element: HTMLElement,
  options: PointerControlOptions
): () => void {
  const { onDrag, onDragStart, onDragEnd, onZoom, cursor = false } = options;

  let dragging = false;
  let last = { x: 0, y: 0 };
  let pinchDistance = 0;

  const previousCursor = element.style.cursor;
  const previousTouchAction = element.style.touchAction;
  if (cursor) element.style.cursor = 'grab';
  // Without this the browser pans/zooms the page instead of giving us the touch
  element.style.touchAction = 'none';

  const touchDistance = (touches: TouchList) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  const beginDrag = (x: number, y: number) => {
    if (!dragging) onDragStart?.();
    dragging = true;
    last = { x, y };
  };
  const endDrag = () => {
    if (dragging) onDragEnd?.();
    dragging = false;
  };

  const onMouseDown = (e: MouseEvent) => {
    beginDrag(e.clientX, e.clientY);
    if (cursor) element.style.cursor = 'grabbing';
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    onDrag?.(e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => {
    endDrag();
    if (cursor) element.style.cursor = 'grab';
  };

  const onWheel = (e: WheelEvent) => {
    if (!onZoom) return;
    e.preventDefault();
    onZoom(e.deltaY);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Second finger down ends the drag, so the view doesn't lurch
      endDrag();
      pinchDistance = touchDistance(e.touches);
    } else if (e.touches.length === 1) {
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = touchDistance(e.touches);
      if (pinchDistance > 0) {
        // Fingers apart shortens the camera distance, hence the inverted sign
        onZoom?.((pinchDistance - distance) * PINCH_TO_WHEEL);
      }
      pinchDistance = distance;
    } else if (dragging && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      onDrag?.(touch.clientX - last.x, touch.clientY - last.y);
      last = { x: touch.clientX, y: touch.clientY };
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    pinchDistance = 0;
    // Lifting one of two fingers resumes dragging from where the other one is,
    // rather than jumping by the gap between them
    if (e.touches.length === 1) {
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else {
      endDrag();
    }
  };

  element.addEventListener('mousedown', onMouseDown);
  element.addEventListener('mousemove', onMouseMove);
  element.addEventListener('mouseup', onMouseUp);
  element.addEventListener('mouseleave', onMouseUp);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('touchstart', onTouchStart, { passive: true });
  element.addEventListener('touchmove', onTouchMove, { passive: false });
  element.addEventListener('touchend', onTouchEnd);
  element.addEventListener('touchcancel', onTouchEnd);

  return () => {
    element.removeEventListener('mousedown', onMouseDown);
    element.removeEventListener('mousemove', onMouseMove);
    element.removeEventListener('mouseup', onMouseUp);
    element.removeEventListener('mouseleave', onMouseUp);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchmove', onTouchMove);
    element.removeEventListener('touchend', onTouchEnd);
    element.removeEventListener('touchcancel', onTouchEnd);
    element.style.cursor = previousCursor;
    element.style.touchAction = previousTouchAction;
  };
}
