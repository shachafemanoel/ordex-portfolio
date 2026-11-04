import { useCallback, useState } from 'react';

export type CardAnimationState = 'idle' | 'success' | 'error' | 'updating' | 'moving';

interface UseCardAnimationReturn {
  animationState: CardAnimationState;
  triggerSuccess: () => void;
  triggerError: () => void;
  triggerUpdating: () => void;
  triggerMoving: () => void;
  reset: () => void;
}

const ANIMATION_DURATION = 1200;

export function useCardAnimation(): UseCardAnimationReturn {
  const [animationState, setAnimationState] = useState<CardAnimationState>('idle');

  const triggerAnimation = useCallback((state: CardAnimationState) => {
    setAnimationState(state);
    setTimeout(() => setAnimationState('idle'), ANIMATION_DURATION);
  }, []);

  return {
    animationState,
    triggerSuccess: useCallback(() => triggerAnimation('success'), [triggerAnimation]),
    triggerError: useCallback(() => triggerAnimation('error'), [triggerAnimation]),
    triggerUpdating: useCallback(() => triggerAnimation('updating'), [triggerAnimation]),
    triggerMoving: useCallback(() => triggerAnimation('moving'), [triggerAnimation]),
    reset: useCallback(() => setAnimationState('idle'), []),
  };
}

/**
 * CSS class map for card animation states.
 * Applied to the card wrapper for visual feedback.
 */
export const CARD_ANIMATION_CLASSES: Record<CardAnimationState, string> = {
  idle: '',
  success:
    'ring-2 ring-green-400 shadow-lg shadow-green-200/50 dark:shadow-green-900/30 animate-card-success',
  error:
    'ring-2 ring-red-400 shadow-lg shadow-red-200/50 dark:shadow-red-900/30 animate-card-error',
  updating:
    'ring-2 ring-blue-400 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30 animate-card-pulse',
  moving:
    'ring-2 ring-indigo-400 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30 animate-card-move',
};
