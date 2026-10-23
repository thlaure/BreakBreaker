/**
 * Keeps a speech bubble inside the visible world area: `x` is the bubble's centre, `halfWidth` its half width in world
 * px (already scaled), `viewLeft`/`viewRight` the camera's world edges. A bubble wider than the view is centred on it.
 */
export function clampBubbleX(x: number, halfWidth: number, viewLeft: number, viewRight: number, margin = 4): number {
  const min = viewLeft + halfWidth + margin;
  const max = viewRight - halfWidth - margin;
  if (min > max) return (viewLeft + viewRight) / 2;
  return Math.min(Math.max(x, min), max);
}
