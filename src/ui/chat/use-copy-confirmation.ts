'use client';

import { useEffect, useState } from 'react';

const CONFIRM_MS = 1800;

/**
 * Copies with `write` and confirms a copy that reached the clipboard for a
 * moment. Each copy is its own confirmation, so copying again restarts the
 * moment instead of cutting it short.
 */
export function useCopyConfirmation(write: () => Promise<boolean>) {
  const [confirmation, setConfirmation] = useState<symbol | null>(null);

  useEffect(() => {
    if (!confirmation) return;
    const timer = setTimeout(() => {
      setConfirmation(null);
    }, CONFIRM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [confirmation]);

  function copy() {
    void write().then((copied) => {
      setConfirmation(copied ? Symbol('copied') : null);
    });
  }

  return { copied: confirmation !== null, copy };
}
