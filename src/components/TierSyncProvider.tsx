import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadCloudAdapter } from '../firebase';
import { TierSyncStore, type SyncSnapshot } from '../tier-sync';

const SyncContext = createContext<{ state: SyncSnapshot; store: TierSyncStore } | null>(null);
export function TierSyncProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new TierSyncStore({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    let active = true;
    store.setOnline(navigator.onLine);
    void loadCloudAdapter().then(adapter => { if (active) store.start(adapter); }).catch(error => { if (active) store.setConfigurationError(error); });
    const online = () => store.setOnline(true), offline = () => store.setOnline(false);
    const visible = () => { if (document.visibilityState === 'visible' && navigator.onLine) store.retry(); };
    window.addEventListener('online', online); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', visible);
    return () => { active = false; store.dispose(); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visible); };
  }, [store]);
  return <SyncContext.Provider value={{ state, store }}>{children}</SyncContext.Provider>;
}
export function useTierSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('티어 저장 기능을 초기화하지 못했어요.');
  return value;
}
