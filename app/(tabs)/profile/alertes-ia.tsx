import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import type { AlerteIA } from '@/store/types';

const NIVEAU_CONFIG = {
  vigilance: {
    color: '#F5A623',
    bgColor: '#FFF8E8',
    borderColor: '#F5A62340',
    label: 'VIGILANCE',
    icon: 'alert-circle' as const,
  },
  alerte: {
    color: Colors.alert,
    bgColor: '#FFF0EA',
    borderColor: '#FF6B3540',
    label: 'ALERTE',
    icon: 'warning' as const,
  },
  urgence: {
    color: Colors.critical,
    bgColor: '#FDE8EA',
    borderColor: '#E6394640',
    label: 'URGENCE',
    icon: 'flame' as const,
  },
} as const;

export default function AlertesIAScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setUnreadCount = useAppStore((s) => s.setUnreadAlertesCount);
  const [alertes, setAlertes] = useState<AlerteIA[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertes = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('alertes_ia')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        15000,
        'Le chargement des alertes prend trop de temps. Vérifiez votre connexion.'
      );

      if (fetchError) throw fetchError;
      setAlertes(data ?? []);

      const unread = (data ?? []).filter((a: AlerteIA) => !a.lu).length;
      setUnreadCount(unread);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    fetchAlertes();
  }, [fetchAlertes]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('alertes_ia')
        .update({ lu: true })
        .eq('id', id);

      if (updateError) throw updateError;

      setAlertes((prev) =>
        prev.map((a) => (a.id === id ? { ...a, lu: true } : a))
      );
      setUnreadCount(Math.max(0, useAppStore.getState().unreadAlertesCount - 1));
    } catch {
      // Silently fail, user can retry
    }
  }, [setUnreadCount]);

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = alertes.filter((a) => !a.lu).map((a) => a.id);
    if (unreadIds.length === 0) return;

    try {
      const { error: updateError } = await supabase
        .from('alertes_ia')
        .update({ lu: true })
        .in('id', unreadIds);

      if (updateError) throw updateError;

      setAlertes((prev) => prev.map((a) => ({ ...a, lu: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, [alertes, setUnreadCount]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAlertes();
  }, [fetchAlertes]);

  const unreadCount = useMemo(
    () => alertes.filter((a) => !a.lu).length,
    [alertes]
  );

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'A l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `Il y a ${diffD}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }, []);

  const renderAlerte = useCallback(({ item }: { item: AlerteIA }) => {
    const config = NIVEAU_CONFIG[item.niveau];
    return (
      <View
        style={[
          styles.alerteCard,
          {
            backgroundColor: item.lu ? Colors.white : config.bgColor,
            borderLeftColor: config.color,
          },
          !item.lu && styles.alerteCardUnread,
        ]}
      >
        <View style={styles.alerteHeader}>
          <View style={[styles.niveauBadge, { backgroundColor: config.color }]}>
            <Ionicons name={config.icon} size={12} color={Colors.white} />
            <Text style={styles.niveauText}>{config.label}</Text>
          </View>
          <Text style={styles.alerteTime}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.alerteBody}>
          <View style={styles.communeRow}>
            <Ionicons name="location" size={14} color={config.color} />
            <Text style={styles.communeName}>{item.commune}</Text>
          </View>
          <Text style={styles.alerteMessage} selectable>{item.message}</Text>
        </View>

        <View style={styles.alerteFooter}>
          <View style={styles.metricsRow}>
            {item.flood_severity !== null && (
              <View style={styles.metricChip}>
                <Ionicons name="water" size={11} color={Colors.textSecondary} />
                <Text style={styles.metricText}>
                  Severite: {(item.flood_severity * 100).toFixed(0)}%
                </Text>
              </View>
            )}
            {item.nb_sos_critiques > 0 && (
              <View style={styles.metricChip}>
                <Ionicons name="warning" size={11} color={Colors.textSecondary} />
                <Text style={styles.metricText}>
                  {item.nb_sos_critiques} SOS
                </Text>
              </View>
            )}
          </View>

          {!item.lu && (
            <TouchableOpacity
              style={styles.markReadButton}
              onPress={() => handleMarkAsRead(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.primary} />
              <Text style={styles.markReadText}>Marquer lu</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [formatDate, handleMarkAsRead]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des alertes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline" size={48} color={Colors.textTertiary} />
        <Text style={styles.errorTitle}>Erreur de chargement</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAlertes} activeOpacity={0.7}>
          <Ionicons name="refresh" size={16} color={Colors.white} />
          <Text style={styles.retryText}>Reessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="notifications" size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Alertes IA</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>Tout lu</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {alertes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="shield-checkmark" size={44} color={Colors.success} />
          </View>
          <Text style={styles.emptyTitle}>Aucune alerte</Text>
          <Text style={styles.emptyDesc}>
            L{"'"}agent IA n{"'"}a detecte aucune situation a risque recemment.
            La communaute est en securite.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alertes}
          keyExtractor={(item) => item.id}
          renderItem={renderAlerte}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.text,
  },
  errorMessage: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.text,
  },
  headerBadge: {
    backgroundColor: Colors.critical,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.white,
    fontVariant: ['tabular-nums'],
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.primary}12`,
  },
  markAllText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  alerteCard: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderLeftWidth: 4,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  alerteCardUnread: {
    boxShadow: '0 3px 12px rgba(15, 25, 51, 0.08)',
    ...Platform.select({ android: { elevation: 3 } as object, default: {} }),
  },
  alerteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  niveauBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  niveauText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  alerteTime: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  alerteBody: {
    gap: 6,
  },
  communeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communeName: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  alerteMessage: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  alerteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  markReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: `${Colors.primary}12`,
  },
  markReadText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${Colors.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  emptyDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
