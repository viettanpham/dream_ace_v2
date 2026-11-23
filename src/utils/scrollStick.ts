export interface ScrollContainerMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export const DEFAULT_BOTTOM_THRESHOLD_PX = 24;
export const DEFAULT_TOP_THRESHOLD_PX = DEFAULT_BOTTOM_THRESHOLD_PX;

/**
 * Pure predicate: returns true if the scrollable container is positioned at (or within
 * `threshold` pixels of) the top edge.
 */
export function isScrolledToTop(
  metrics: ScrollContainerMetrics,
  threshold = DEFAULT_TOP_THRESHOLD_PX
): boolean {
  const scrollHeight = Number.isFinite(metrics.scrollHeight)
    ? Math.max(0, metrics.scrollHeight)
    : 0;
  const scrollTop = Number.isFinite(metrics.scrollTop)
    ? Math.max(0, metrics.scrollTop)
    : 0;
  const clientHeight = Number.isFinite(metrics.clientHeight)
    ? Math.max(0, metrics.clientHeight)
    : 0;
  const safeThreshold = Number.isFinite(threshold)
    ? Math.max(0, threshold)
    : DEFAULT_TOP_THRESHOLD_PX;

  if (scrollHeight <= clientHeight) return true;
  return scrollTop <= safeThreshold;
}

/**
 * Computes stick-to-top UI state after a user scroll event (newest-first mode).
 */
export function computeTopStickScrollState(
  metrics: ScrollContainerMetrics,
  threshold = DEFAULT_TOP_THRESHOLD_PX
): { isAtTop: boolean; isScrolledAway: boolean } {
  const atTop = isScrolledToTop(metrics, threshold);
  return {
    isAtTop: atTop,
    isScrolledAway: !atTop,
  };
}

/**
 * Pure predicate: returns true if the scrollable container is positioned at (or within
 * `threshold` pixels of) the bottom edge.
 */
export function isScrolledToBottom(
  metrics: ScrollContainerMetrics,
  threshold = DEFAULT_BOTTOM_THRESHOLD_PX
): boolean {
  const scrollHeight = Number.isFinite(metrics.scrollHeight)
    ? Math.max(0, metrics.scrollHeight)
    : 0;
  const scrollTop = Number.isFinite(metrics.scrollTop)
    ? Math.max(0, metrics.scrollTop)
    : 0;
  const clientHeight = Number.isFinite(metrics.clientHeight)
    ? Math.max(0, metrics.clientHeight)
    : 0;
  const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 24;

  // If all content fits in the viewport, user is always at the bottom
  if (scrollHeight <= clientHeight) return true;

  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  return distanceFromBottom <= safeThreshold;
}

/**
 * Computes stick-to-bottom UI state after a user scroll event.
 */
export function computeStickScrollState(
  metrics: ScrollContainerMetrics,
  threshold = DEFAULT_BOTTOM_THRESHOLD_PX
): { isAtBottom: boolean; showJumpToLatest: boolean } {
  const atBottom = isScrolledToBottom(metrics, threshold);
  return {
    isAtBottom: atBottom,
    showJumpToLatest: !atBottom,
  };
}

/**
 * Determines the next scrollTop value when new log entries append.
 * Only jumps to bottom if the container was already pinned to bottom.
 */
export function getNextScrollTopOnAppend(
  isAtBottom: boolean,
  currentScrollTop: number,
  scrollHeight: number
): number {
  const safeHeight = Number.isFinite(scrollHeight) ? Math.max(0, scrollHeight) : 0;
  const safeCurrent = Number.isFinite(currentScrollTop)
    ? Math.max(0, currentScrollTop)
    : 0;
  return isAtBottom ? safeHeight : safeCurrent;
}
