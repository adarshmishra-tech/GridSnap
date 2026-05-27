import { useEffect, useMemo } from 'react';
import { initSounds, playSound, setMuted } from '../utils/audioManager';

export function useSoundEffects(enabled) {
  useEffect(() => {
    initSounds().catch(() => {});
  }, []);

  useEffect(() => {
    setMuted(!enabled);
  }, [enabled]);

  return useMemo(() => ({
    tap: () => playSound('PLACE'),
    clear: () => playSound('CLEAR'),
    win: () => playSound('WIN'),
    lose: () => playSound('LOSE'),
  }), []);
}

export default useSoundEffects;
