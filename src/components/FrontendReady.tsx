import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

export default function FrontendReady() {
  useEffect(() => {
    if (!isTauri()) return;
    void emit('photowall://frontend-ready');
  }, []);

  return null;
}

