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

/**
 * Preserves the reader's viewport offset when newer log rows are prepended above in newest-first order.
 */
export function computePreservedScrollTopOnPrepend(
  prevScrollTop: number,
  prevScrollHeight: number,
  nextScrollHeight: number
): number {
  const safeTop = Number.isFinite(prevScrollTop) ? Math.max(0, prevScrollTop) : 0;
  if (!Number.isFinite(prevScrollHeight) || prevScrollHeight <= 0) {
    return safeTop;
  }
  const safePrevH = Math.max(0, prevScrollHeight);
  const safeNextH = Number.isFinite(nextScrollHeight)
    ? Math.max(safePrevH, nextScrollHeight)
    : safePrevH;
  return safeTop + (safeNextH - safePrevH);
}

/**
 * Pure predicate for phone inlineFlow (page-level scroll without nested scroll container):
 * returns true unless the user has scrolled past the top of the inline combat log.
 */
export function isInlineFlowAtTop(
  elementTopPx: number,
  elementHeightPx: number,
  windowScrollY: number,
  stickyHeaderPx = 48,
  threshold = DEFAULT_TOP_THRESHOLD_PX
): boolean {
  const safeTop = Number.isFinite(elementTopPx) ? elementTopPx : 0;
  const safeHeight = Number.isFinite(elementHeightPx)
    ? Math.max(0, elementHeightPx)
    : 0;
  const safeScrollY = Number.isFinite(windowScrollY)
    ? Math.max(0, windowScrollY)
    : 0;
  const safeSticky = Number.isFinite(stickyHeaderPx)
    ? Math.max(0, stickyHeaderPx)
    : 48;
  const safeThreshold = Number.isFinite(threshold)
    ? Math.max(0, threshold)
    : DEFAULT_TOP_THRESHOLD_PX;

  if (safeScrollY <= 0 && safeTop >= 0) return true;
  if (safeHeight > 0) {
    return safeTop >= safeSticky - safeThreshold;
  }
  return safeScrollY <= safeThreshold;
}
