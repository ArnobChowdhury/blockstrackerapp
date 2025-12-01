import { useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/useAppContext';

export const useRefreshScreenAfterSync = (
  refreshCB: () => void,
  screenName: string,
) => {
  const { user, isSyncing } = useAppContext();

  const shouldRefresh = useRef(false);
  useEffect(() => {
    if (user && !isSyncing && shouldRefresh.current) {
      console.log(
        `[useRefreshScreenAfterSync] Refreshing ${screenName} screen...`,
      );
      refreshCB();
    }
    shouldRefresh.current = isSyncing;
  }, [isSyncing, refreshCB, screenName, user]);
};
