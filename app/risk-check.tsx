import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';

const RISK_RADIUS_KM = 2;
const SIGNAL_RADIUS_KM = 1;
const VIGILANCE_RADIUS_KM = 3;
const HISTORY_KEY = 'risk_check_history';
const MAX_HISTORY = 3;

type RiskLevel = 'high' | 'vigilance' | 'safe';

interface NearbyItem {
  id: string;
  label: string;
  type: 'zone_risque' | 'signalement';
  distance: number;
  quartier: string | null;
}

interface RiskResult {
  level: RiskLevel;
  nearbyItems: NearbyItem[];
  searchLabel: string;
  timestamp: string;
}

interface HistoryEntry {
  searchLabel: string;
  level: RiskLevel;
  timestamp: string;
  nearbyCount: number;
}

// Haversine distance in km
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

function getRiskConfig(level: RiskLevel) {
  switch (level) {
    case 'high':
      return {
        color: '#e53935',
        bgColor: 'rgba(229, 57, 53, 0.08)',
        borderColor: 'rgba(229, 57, 53, 0.25)',
        icon: 'alert-circle' as const,
        title: 'Zone a risque eleve',
        description:
          'Votre position se trouve a proximite d\'une zone documentee comme a risque d\'inondation ou d\'un signalement actif.',
      };
    case 'vigilance':
      return {
        color: '#FF6B35',
        bgColor: 'rgba(255, 107, 53, 0.08)',
        borderColor: 'rgba(255, 107, 53, 0.25)',
        icon: 'warning' as const,
        title: 'Zone de vigilance',
        description:
          'Des zones a risque sont documentees dans un rayon de 3 km. Restez attentif en cas de fortes pluies.',
      };
    case 'safe':
      return {
        color: '#2DC653',
        bgColor: 'rgba(45, 198, 83, 0.08)',
        borderColor: 'rgba(45, 198, 83, 0.25)',
        icon: 'checkmark-circle' as const,
        title: 'Zone non documentee',
        description:
          'Aucune zone a risque ou signalement actif n\'a ete documente a proximite. Cela ne garantit pas l\'absence de risque.',
      };
  }
}

export default function RiskCheckScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addMessage = useAppStore((s) => s.addMessage);

  const [mode, setMode] = useState<'idle' | 'gps' | 'text'>('idle');
  const [addressInput, setAddressInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history on mount
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(HISTORY_KEY);
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch {
        // Non-critical
      }
    };
    load();
  }, []);

  const saveToHistory = useCallback(async (entry: HistoryEntry) => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      const existing: HistoryEntry[] = stored ? JSON.parse(stored) : [];
      const updated = [entry, ...existing].slice(0, MAX_HISTORY);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      setHistory(updated);
    } catch {
      // Non-critical
    }
  }, []);

  const performRiskCheck = useCallback(
    async (lat: number, lon: number, searchLabel: string) => {
      // Fetch zone_risque entries with coordinates
      const { data: zones, error: zErr } = await withTimeout(
        supabase
          .from('community_knowledge')
          .select('id, titre, quartier, geo_lat, geo_lon, latitude, longitude')
          .eq('categorie', 'zone_risque')
          .eq('validated', true),
        10000,
        'Timeout lors de la recherche de zones a risque'
      );

      if (zErr) throw new Error(zErr.message);

      // Fetch active SOS signals
      const { data: signals, error: sErr } = await withTimeout(
        supabase
          .from('sos_signals')
          .select('id, description, quartier, latitude, longitude')
          .eq('type', 'inondation'),
        10000,
        'Timeout lors de la recherche de signalements'
      );

      if (sErr) throw new Error(sErr.message);

      const nearbyItems: NearbyItem[] = [];

      // Check zones
      if (zones) {
        for (const z of zones) {
          const zLat = z.geo_lat ?? z.latitude;
          const zLon = z.geo_lon ?? z.longitude;
          if (zLat == null || zLon == null) continue;

          const dist = haversineKm(lat, lon, zLat, zLon);
          if (dist <= VIGILANCE_RADIUS_KM) {
            nearbyItems.push({
              id: z.id,
              label: z.titre ?? 'Zone a risque',
              type: 'zone_risque',
              distance: dist,
              quartier: z.quartier,
            });
          }
        }
      }

      // Check signals
      if (signals) {
        for (const s of signals) {
          if (s.latitude == null || s.longitude == null) continue;

          const dist = haversineKm(lat, lon, s.latitude, s.longitude);
          if (dist <= VIGILANCE_RADIUS_KM) {
            nearbyItems.push({
              id: s.id,
              label: s.description ?? 'Signalement inondation',
              type: 'signalement',
              distance: dist,
              quartier: s.quartier,
            });
          }
        }
      }

      // Sort by distance
      nearbyItems.sort((a, b) => a.distance - b.distance);

      // Determine risk level
      let level: RiskLevel = 'safe';
      const hasHighRisk = nearbyItems.some(
        (item) =>
          (item.type === 'zone_risque' && item.distance <= RISK_RADIUS_KM) ||
          (item.type === 'signalement' && item.distance <= SIGNAL_RADIUS_KM)
      );
      const hasVigilance = nearbyItems.length > 0;

      if (hasHighRisk) {
        level = 'high';
      } else if (hasVigilance) {
        level = 'vigilance';
      }

      const riskResult: RiskResult = {
        level,
        nearbyItems: nearbyItems.slice(0, 8),
        searchLabel,
        timestamp: new Date().toISOString(),
      };

      setResult(riskResult);

      // Save to history
      await saveToHistory({
        searchLabel,
        level,
        timestamp: riskResult.timestamp,
        nearbyCount: nearbyItems.length,
      });
    },
    [saveToHistory]
  );

  const performRiskCheckByText = useCallback(
    async (query: string) => {
      // Search community_knowledge for matching quartier/commune
      const { data: zones, error: zErr } = await withTimeout(
        supabase
          .from('community_knowledge')
          .select('id, titre, quartier, commune, geo_lat, geo_lon, latitude, longitude')
          .eq('categorie', 'zone_risque')
          .eq('validated', true)
          .or(
            `quartier.ilike.%${query}%,commune.ilike.%${query}%,titre.ilike.%${query}%`
          ),
        10000,
        'Timeout lors de la recherche'
      );

      if (zErr) throw new Error(zErr.message);

      // Search SOS signals by quartier
      const { data: signals, error: sErr } = await withTimeout(
        supabase
          .from('sos_signals')
          .select('id, description, quartier, latitude, longitude')
          .eq('type', 'inondation')
          .ilike('quartier', `%${query}%`),
        10000,
        'Timeout lors de la recherche de signalements'
      );

      if (sErr) throw new Error(sErr.message);

      const nearbyItems: NearbyItem[] = [];

      // Add matching zones (text match — distance shown as 0 for exact quartier match)
      if (zones && zones.length > 0) {
        for (const z of zones) {
          nearbyItems.push({
            id: z.id,
            label: z.titre ?? 'Zone a risque',
            type: 'zone_risque',
            distance: 0,
            quartier: z.quartier,
          });
        }
      }

      // Add matching signals
      if (signals && signals.length > 0) {
        for (const s of signals) {
          nearbyItems.push({
            id: s.id,
            label: s.description ?? 'Signalement inondation',
            type: 'signalement',
            distance: 0,
            quartier: s.quartier,
          });
        }
      }

      // If no text matches found but zones exist with coordinates, do GPS-based fallback
      if (nearbyItems.length === 0 && zones && zones.length > 0) {
        const refPoint = zones.find(
          (z: any) => (z.geo_lat ?? z.latitude) != null && (z.geo_lon ?? z.longitude) != null
        );
        if (refPoint) {
          const lat = refPoint.geo_lat ?? refPoint.latitude;
          const lon = refPoint.geo_lon ?? refPoint.longitude;
          if (lat != null && lon != null) {
            await performRiskCheck(lat, lon, query);
            return;
          }
        }
      }

      // Determine risk level
      let level: RiskLevel = 'safe';
      if (nearbyItems.some((item) => item.type === 'zone_risque')) {
        level = 'high';
      } else if (nearbyItems.some((item) => item.type === 'signalement')) {
        level = 'high';
      }

      const riskResult: RiskResult = {
        level,
        nearbyItems: nearbyItems.slice(0, 8),
        searchLabel: query,
        timestamp: new Date().toISOString(),
      };

      setResult(riskResult);

      await saveToHistory({
        searchLabel: query,
        level,
        timestamp: riskResult.timestamp,
        nearbyCount: nearbyItems.length,
      });
    },
    [performRiskCheck, saveToHistory]
  );

  const checkByGPS = useCallback(async () => {
    setMode('gps');
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(
          'Permission de localisation refusee. Activez la localisation dans les reglages de votre appareil pour utiliser cette fonctionnalite.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      await performRiskCheck(latitude, longitude, 'Ma position actuelle');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Erreur lors de la geolocalisation';
      setError(`Impossible d'obtenir votre position : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [performRiskCheck]);

  const checkByAddress = useCallback(async () => {
    const query = addressInput.trim();
    if (!query) return;

    setMode('text');
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      await performRiskCheckByText(query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Erreur lors de la verification : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [addressInput, performRiskCheckByText]);

  const handleAskAminata = useCallback(() => {
    const searchLabel = result?.searchLabel ?? addressInput ?? 'ma zone';
    const question = `Quels sont les risques d'inondation pour la zone ${searchLabel} ? Quelles precautions prendre ?`;
    addMessage({
      id: `pre_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    });
    router.dismiss();
    setTimeout(() => {
      router.push('/(tabs)/orientation');
    }, 100);
  }, [result, addressInput, addMessage, router]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setMode('idle');
    setAddressInput('');
  }, []);

  const riskConfig = result ? getRiskConfig(result.level) : null;

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Suis-je en zone a risque ?',
          headerTitleStyle: { fontFamily: Fonts.semiBold, fontSize: 16 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.dismiss()} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Input Section */}
        {!result && !loading && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Verifiez votre zone</Text>
            <Text style={styles.sectionSubtitle}>
              Decouvrez si votre position ou votre quartier se trouve a proximite d{"'"}une
              zone a risque documentee par la communaute.
            </Text>

            {/* GPS Button */}
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={checkByGPS}
              activeOpacity={0.8}
            >
              <View style={styles.gpsIconCircle}>
                <Ionicons name="navigate" size={22} color={Colors.primary} />
              </View>
              <View style={styles.gpsButtonTextBlock}>
                <Text style={styles.gpsButtonTitle}>Ma position actuelle</Text>
                <Text style={styles.gpsButtonSubtitle}>
                  Utiliser le GPS pour localiser ma position
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Address Input */}
            <View style={styles.addressInputRow}>
              <TextInput
                style={styles.addressInput}
                placeholder="Saisir un quartier ou une adresse..."
                placeholderTextColor={Colors.textTertiary}
                value={addressInput}
                onChangeText={setAddressInput}
                returnKeyType="search"
                onSubmitEditing={checkByAddress}
              />
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  !addressInput.trim() && styles.searchButtonDisabled,
                ]}
                onPress={checkByAddress}
                disabled={!addressInput.trim()}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <Text style={styles.addressHint}>
              Ex: Kalaban-Coura, Sotuba, Badalabougou, Niamakoro...
            </Text>
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {mode === 'gps'
                ? 'Localisation en cours...'
                : 'Recherche en cours...'}
            </Text>
            <Text style={styles.loadingSubtext}>
              Analyse des zones a risque et signalements actifs
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="close-circle" size={32} color={Colors.critical} />
            </View>
            <Text style={styles.errorTitle}>Erreur</Text>
            <Text style={styles.errorMessage} selectable>
              {error}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleReset} activeOpacity={0.7}>
              <Ionicons name="refresh" size={16} color={Colors.primary} />
              <Text style={styles.retryButtonText}>Reessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result */}
        {result && riskConfig && !loading && (
          <View style={styles.resultSection}>
            {/* Risk Level Card */}
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: riskConfig.bgColor,
                  borderColor: riskConfig.borderColor,
                },
              ]}
            >
              <View style={[styles.resultIconCircle, { backgroundColor: riskConfig.color }]}>
                <Ionicons name={riskConfig.icon} size={28} color={Colors.white} />
              </View>
              <Text style={[styles.resultTitle, { color: riskConfig.color }]}>
                {riskConfig.title}
              </Text>
              <Text style={styles.resultDescription}>{riskConfig.description}</Text>
              <View style={styles.resultMeta}>
                <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.resultMetaText}>{result.searchLabel}</Text>
              </View>
            </View>

            {/* Nearby Items List */}
            {result.nearbyItems.length > 0 && (
              <View style={styles.nearbySection}>
                <Text style={styles.nearbySectionTitle}>
                  Zones et signalements a proximite
                </Text>
                {result.nearbyItems.map((item) => (
                  <View key={item.id} style={styles.nearbyItem}>
                    <View
                      style={[
                        styles.nearbyDot,
                        {
                          backgroundColor:
                            item.type === 'zone_risque' ? '#e53935' : '#FF6B35',
                        },
                      ]}
                    />
                    <View style={styles.nearbyItemContent}>
                      <Text style={styles.nearbyItemLabel} numberOfLines={2}>
                        {item.label}
                      </Text>
                      <View style={styles.nearbyItemMeta}>
                        <Text style={styles.nearbyItemType}>
                          {item.type === 'zone_risque' ? 'Zone a risque' : 'Signalement'}
                        </Text>
                        {item.distance > 0 && (
                          <>
                            <Text style={styles.nearbyItemSep}>·</Text>
                            <Text style={styles.nearbyItemDistance}>
                              {formatDistance(item.distance)}
                            </Text>
                          </>
                        )}
                        {item.quartier && (
                          <>
                            <Text style={styles.nearbyItemSep}>·</Text>
                            <Text style={styles.nearbyItemQuartier}>
                              {item.quartier}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.aminataButton}
                onPress={handleAskAminata}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubbles" size={18} color={Colors.white} />
                <Text style={styles.aminataButtonText}>Demander a Aminata</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.resetButtonText}>Nouvelle recherche</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* History Section */}
        {!loading && !result && history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>Dernieres verifications</Text>
            {history.map((entry, idx) => {
              const config = getRiskConfig(entry.level);
              return (
                <View key={`${entry.timestamp}-${idx}`} style={styles.historyItem}>
                  <View
                    style={[styles.historyDot, { backgroundColor: config.color }]}
                  />
                  <View style={styles.historyContent}>
                    <Text style={styles.historyLabel}>{entry.searchLabel}</Text>
                    <Text style={styles.historyMeta}>
                      {entry.nearbyCount} resultat(s) ·{' '}
                      {new Date(entry.timestamp).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.historyBadge,
                      { backgroundColor: `${config.color}15` },
                    ]}
                  >
                    <Ionicons name={config.icon} size={12} color={config.color} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 20,
    gap: 24,
  },
  // Input Section
  inputSection: {
    gap: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderCurve: 'continuous',
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  gpsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31, 121, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsButtonTextBlock: {
    flex: 1,
    gap: 2,
  },
  gpsButtonTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  gpsButtonSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  // Address Input
  addressInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addressInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(31, 121, 235, 0.3)',
  },
  searchButtonDisabled: {
    backgroundColor: Colors.textTertiary,
    boxShadow: 'none',
  },
  addressHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textTertiary,
    paddingLeft: 4,
  },
  // Loading
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.text,
  },
  loadingSubtext: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Error
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  errorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(230, 57, 70, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.critical,
  },
  errorMessage: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(31, 121, 235, 0.08)',
    marginTop: 8,
  },
  retryButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  // Result Section
  resultSection: {
    gap: 20,
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderCurve: 'continuous',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  resultIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  resultTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    textAlign: 'center',
  },
  resultDescription: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resultMetaText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  // Nearby Section
  nearbySection: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderCurve: 'continuous',
  },
  nearbySectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  nearbyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  nearbyItemContent: {
    flex: 1,
    gap: 3,
  },
  nearbyItemLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  nearbyItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  nearbyItemType: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  nearbyItemSep: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  nearbyItemDistance: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  nearbyItemQuartier: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  // Actions
  actionsRow: {
    gap: 10,
  },
  aminataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderCurve: 'continuous',
    boxShadow: '0 4px 12px rgba(31, 121, 235, 0.25)',
    ...Platform.select({ android: { elevation: 4 } as object, default: {} }),
  },
  aminataButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(31, 121, 235, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  resetButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  // History
  historySection: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderCurve: 'continuous',
  },
  historySectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyContent: {
    flex: 1,
    gap: 2,
  },
  historyLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  historyMeta: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  historyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
