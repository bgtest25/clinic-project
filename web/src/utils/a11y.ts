import type { KeyboardEvent, MouseEvent } from 'react';

export function rowActivation(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (_e: MouseEvent) => onActivate(),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
