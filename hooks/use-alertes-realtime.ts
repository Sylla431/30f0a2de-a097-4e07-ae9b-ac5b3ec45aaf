import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import type { AlerteIA } from '@/store/types';

/**
 * Hook that subscribes to realtime inserts on the alertes_ia table.
 * When a new alerte arrives, it updates the unread count and shows the banner.
 */
export function useAlertesRealtime() {
  const setUnreadCount = useAppStore((s) => s.setUnreadAlertesCount);
  const setLatestAlerte = useAppStore((s) => s.setLatestAlerte);
  const setShowBanner = useAppStore((s) => s.setShowAlerteBanner);
  const mountedRef = useRef(true);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await withTimeout(
        supabase
          .from('alertes_ia')
          .select('id', { count: 'exact', head: true })
          .eq('lu', false),
        10000,
        'Délai dépassé lors du chargement des alertes.'
      );
      if (mountedRef.current) {
        setUnreadCount(count ?? 0);
      }
    } catch {
      // Silent — non-critical initial count fetch
    }
  }, [setUnreadCount]);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch initial unread count
    fetchUnreadCount();

    // Subscribe to realtime inserts
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel('alertes-ia-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alertes_ia',
          },
          (payload) => {
            if (!mountedRef.current) return;
            const newAlerte = payload.new as AlerteIA;
            setLatestAlerte(newAlerte);
            setShowBanner(true);
            // Increment unread count
            const currentCount = useAppStore.getState().unreadAlertesCount;
            setUnreadCount(currentCount + 1);
          }
        )
        .subscribe();
    } catch {
      // Realtime subscription failed — non-critical
    }

    return () => {
      mountedRef.current = false;
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {
          // Cleanup failure — non-critical
        }
      }
    };
  }, [fetchUnreadCount, setLatestAlerte, setShowBanner, setUnreadCount]);
}
