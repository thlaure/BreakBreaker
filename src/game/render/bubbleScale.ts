/**
 * Whole-number scale of a speech bubble: about 16 screen px tall at camera zoom 1 and 2 on a roomy window, but half that
 * on a compact one (under 560 px wide or 520 px tall, the HUD's rule) where a x2 bubble covers a good part of the view.
 */
export function bubbleScale(zoom: number, viewWidth: number, viewHeight: number): number {
  const z = zoom || 1;
  const compact = viewWidth < 560 || viewHeight < 520;
  return Math.max(1, Math.round((compact ? 1 : 2) / z));
}
