import { Hand, HandPeace, ThumbsDown, ThumbsUp, HandWaving, type IconProps } from '@phosphor-icons/react';
import type { Gesture } from '../lib/types';

export function GestureIcon({ gesture, ...props }: { gesture: Gesture } & IconProps) {
  const Icon = ({ Thumb_Up: ThumbsUp, Thumb_Down: ThumbsDown, Open_Palm: HandWaving, Victory: HandPeace } as Record<string, typeof Hand>)[gesture.mediaPipeCategory ?? ''] ?? Hand;
  return <Icon weight="regular" size={28} {...props} />;
}
