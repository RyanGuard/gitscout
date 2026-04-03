'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { SoundContext, getSoundEngine, type SoundContextType } from '@/lib/sounds';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setEnabled(getSoundEngine().rawEnabled));
  }, []);

  const toggle = useCallback(() => {
    const newState = getSoundEngine().toggle();
    setEnabled(newState);
  }, []);

  const value: SoundContextType = {
    enabled,
    toggle,
    playSearch: () => getSoundEngine().playSearch(),
    playUnicorn: () => getSoundEngine().playUnicorn(),
    playSave: () => getSoundEngine().playSave(),
    playCopy: () => getSoundEngine().playCopy(),
    playComplete: () => getSoundEngine().playComplete(),
    playExport: () => getSoundEngine().playExport(),
  };

  return (
    <SoundContext value={value}>
      {children}
    </SoundContext>
  );
}

export function SoundToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setEnabled(getSoundEngine().rawEnabled));
  }, []);

  const handleToggle = () => {
    const newState = getSoundEngine().toggle();
    setEnabled(newState);
  };

  return (
    <button
      onClick={handleToggle}
      className="relative p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
      aria-label={enabled ? 'Mute sounds' : 'Enable sounds'}
      title={enabled ? 'Mute sounds' : 'Enable sounds'}
    >
      {enabled ? (
        <Volume2 className="w-4 h-4" />
      ) : (
        <VolumeX className="w-4 h-4" />
      )}
    </button>
  );
}
