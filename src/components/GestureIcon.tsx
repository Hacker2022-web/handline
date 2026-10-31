import {
  Hand,
  HandPeace,
  ThumbsDown,
  ThumbsUp,
  HandWaving,
  HandPointing,
  HandHeart,
  HandFist,
  HandPalm,
  HandsPraying,
  HandsClapping,
  CheckCircle,
  type IconProps
} from '@phosphor-icons/react';
import type { Gesture } from '../lib/types';

export function GestureIcon({ gesture, ...props }: { gesture: Gesture } & IconProps) {
  const Icon = ({
    Thumb_Up: ThumbsUp,
    Thumb_Down: ThumbsDown,
    Stop_Hand: HandPalm,
    Victory: HandPeace,
    OK_Sign: CheckCircle,
    Pointing_Up: HandPointing,
    Open_Palm: HandWaving,
    Closed_Fist: HandFist,
    Crossed_Fingers: HandHeart,
    Shaka: Hand,
    Two_Thumbs_Up: ThumbsUp,
    Two_Open_Palms: HandsClapping,
    Two_Victory: HandPeace,
    Two_Fists: HandFist,
    Hands_Praying: HandsPraying,
  } as Record<string, typeof Hand>)[gesture.mediaPipeCategory ?? ''] ?? Hand;
  return <Icon weight="regular" size={28} {...props} />;
}
