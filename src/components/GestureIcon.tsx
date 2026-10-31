import { Hand, HandPeace, ThumbsDown, ThumbsUp, HandWaving, HandPointing, HandHeart, HandFist, HandsPraying, HandsClapping, type IconProps } from '@phosphor-icons/react';
import type { Gesture } from '../lib/types';

export function GestureIcon({ gesture, ...props }: { gesture: Gesture } & IconProps) {
  const Icon = ({
    Thumb_Up: ThumbsUp,
    Thumb_Down: ThumbsDown,
    Open_Palm: HandWaving,
    Victory: HandPeace,
    Pointing_Up: HandPointing,
    ILoveYou: HandHeart,
    Closed_Fist: HandFist,
    Two_Thumbs_Up: ThumbsUp,
    Two_Open_Palms: HandsClapping,
    Two_Victory: HandPeace,
    Two_Fists: HandFist,
    Hands_Praying: HandsPraying,
  } as Record<string, typeof Hand>)[gesture.mediaPipeCategory ?? ''] ?? Hand;
  return <Icon weight="regular" size={28} {...props} />;
}
