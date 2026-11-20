export const EVENT_COLORS = [
  '#a855f7', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#eab308', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#ef4444', // red
] as const;

export const EVENT_EMOJIS = ['🎮', '🎃', '👻', '🎤', '🍳', '🧩', '🏆', '🎲', '🎨', '💬', '🎵', '🏋️', '🍕', '🎁', '⚔️', '🚗'];

export function eventColor(color: string | undefined, fallback = EVENT_COLORS[0]): string {
  return color || fallback;
}
