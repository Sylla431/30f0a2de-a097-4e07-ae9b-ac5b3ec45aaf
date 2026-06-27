import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { BAMAKO_CENTER } from '@/constants/Quartiers';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import { LoadingState } from '@/components/loading-state';
import { ErrorState } from '@/components/error-state';
import OsmMap from '@/components/osm-map';
import type { CarteMarker, FloodEvent } from '@/store/types';

// Layer configuration
const LAYER_COLORS: Record<string, string> = {
  savoir: '#1f79eb',
  signalements: '#e53935',
  evenements: '#7B1FA2',
};

type LayerKey = 'savoir' | 'signalements' | 'evenements';

interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  icon: string;
  layer: LayerKey;
  size?: number;
  data: CarteMarker | FloodEvent;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addMessage = useAppStore((s) => s.addMessage);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layer visibility toggles — all active by default
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    new Set(['savoir', 'signalements', 'evenements'])
  );

  // Data stores — unified view for savoir+signalements, separate for flood events
  const [markers, setMarkers] = useState<CarteMarker[]>([]);
  const [floodData, setFloodData] = useState<FloodEvent[]>([]);

  // Selected pin for bottom sheet
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  // Fetch all data from Supabase using the unified view
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [markersResult, floodResult] = await Promise.allSettled([
        withTimeout(
          supabase.from('carte_markers_v').select('*').then((res) => res),
          15000,
          'Le chargement des données de la carte prend trop de temps. Vérifiez votre connexion et réessayez.'
        ),
        supabase
          .from('flood_events')
          .select('*')
          .order('event_date', { ascending: false })
          .limit(50),
      ]);

      if (markersResult.status === 'rejected') {
        throw markersResult.reason;
      }

      const markersRes = markersResult.value;
      if (markersRes.error) {
        throw new Error(markersRes.error.message || 'Erreur carte_markers_v');
      }

      setMarkers(Array.isArray(markersRes.data) ? (markersRes.data as CarteMarker[]) : []);

      if (floodResult.status === 'fulfilled' && !floodResult.value.error && Array.isArray(floodResult.value.data)) {
        setFloodData(floodResult.value.data);
      } else {
        setFloodData([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de charger les données : ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for sos_signals — refetch markers on changes
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel('sos_signals_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sos_signals', filter: 'type=eq.inondation' },
          () => {
            // Refetch markers from unified view on any sos_signals change
            Promise.resolve(
              supabase
                .from('carte_markers_v')
                .select('*')
            )
              .then((res) => {
                if (!res.error && Array.isArray(res.data)) {
                  setMarkers(res.data as CarteMarker[]);
                }
              })
              .catch(() => {
                // Refetch failed — non-critical, current data remains displayed
              });
          }
        )
        .subscribe();
    } catch {
      // Realtime subscription failed — non-critical, data still loads via fetch
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Cleanup failure — non-critical
        }
      }
    };
  }, []);

  // Derived counts for layer toggles
  const savoirCount = useMemo(
    () => markers.filter((m) => m.marker_type === 'savoir').length,
    [markers]
  );
  const signalementsCount = useMemo(
    () => markers.filter((m) => m.marker_type === 'signalement').length,
    [markers]
  );

  // Build pins from unified view + flood data
  const allPins = useMemo((): MapPin[] => {
    const pins: MapPin[] = [];

    // Calque 1 & 2 — from carte_markers_v unified view
    if (Array.isArray(markers)) {
      markers.forEach((m) => {
        if (!m || !m.marker_id) return;
        if (m.latitude == null || m.longitude == null) return;
        if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return;

        if (m.marker_type === 'savoir') {
          let icon = 'bulb';
          let color = LAYER_COLORS.savoir;

          if (m.categorie === 'signe_precurseur') {
            icon = 'eye';
          } else if (m.categorie === 'zone_risque') {
            icon = 'alert-circle';
            color = '#F57C00';
          } else if (m.categorie === 'observation') {
            icon = 'person';
          } else if (m.categorie === 'memoire' || m.categorie === 'memoire_instrumentale') {
            icon = 'book';
          }

          pins.push({
            id: `k_${m.marker_id}`,
            latitude: m.latitude,
            longitude: m.longitude,
            color,
            icon,
            layer: 'savoir',
            data: m,
          });
        } else if (m.marker_type === 'signalement') {
          pins.push({
            id: `s_${m.marker_id}`,
            latitude: m.latitude,
            longitude: m.longitude,
            color: LAYER_COLORS.signalements,
            icon: 'warning',
            layer: 'signalements',
            data: m,
          });
        }
      });
    }

    // Calque 3 — Evenements IA (from flood_events table, still separate)
    if (Array.isArray(floodData)) {
      floodData.forEach((f) => {
        if (!f || !f.id) return;
        if (f.latitude == null || f.longitude == null) return;
        if (typeof f.latitude !== 'number' || typeof f.longitude !== 'number') return;

        const severity = typeof f.flood_severity === 'number' ? f.flood_severity : 0;
        const size = severity > 0.7 ? 34 : severity > 0.4 ? 28 : 24;

        pins.push({
          id: `f_${f.id}`,
          latitude: f.latitude,
          longitude: f.longitude,
          color: LAYER_COLORS.evenements,
          icon: 'flash',
          layer: 'evenements',
          size,
          data: f,
        });
      });
    }

    return pins;
  }, [markers, floodData]);

  // Filter pins by active layers
  const visiblePins = useMemo(() => {
    return allPins.filter((pin) => activeLayers.has(pin.layer));
  }, [allPins, activeLayers]);

  // OsmMap-compatible pin format
  const osmPins = useMemo(() => {
    return visiblePins.map((pin) => ({
      id: pin.id,
      latitude: pin.latitude,
      longitude: pin.longitude,
      color: pin.color,
      icon: pin.icon,
      layer: pin.layer,
      size: pin.size,
    }));
  }, [visiblePins]);

  const toggleLayer = useCallback((layer: LayerKey) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  const handlePinPress = useCallback(
    (pinId: string) => {
      const pin = allPins.find((p) => p.id === pinId);
      if (pin) {
        setSelectedPin(pin);
      }
    },
    [allPins]
  );

  const handleAskAminata = useCallback(
    (titre: string) => {
      setSelectedPin(null);
      const question = `Dis-moi en plus sur : ${titre}`;
      try {
        addMessage({
          id: `pre_${Date.now()}`,
          role: 'user',
          content: question,
          timestamp: new Date().toISOString(),
        });
        router.push('/(tabs)/orientation');
      } catch {
        // Navigation or store error — non-critical
      }
    },
    [router, addMessage]
  );

  // Determine if clustering should be enabled
  const enableClustering = visiblePins.length > 20;

  if (loading) return <LoadingState message="Chargement de la carte..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapWrapper}>
        <OsmMap
          pins={osmPins}
          center={{ latitude: BAMAKO_CENTER.latitude, longitude: BAMAKO_CENTER.longitude }}
          zoom={12}
          onPinPress={handlePinPress}
          enableClustering={enableClustering}
        />

        {/* Layer toggles overlay — top of map */}
        <View style={[styles.toggleOverlay, { top: Platform.OS === 'web' ? 12 : insets.top + 12 }]}>
          <LayerToggle
            label="Savoir local"
            color={LAYER_COLORS.savoir}
            icon="eye-outline"
            active={activeLayers.has('savoir')}
            onPress={() => toggleLayer('savoir')}
            count={savoirCount}
          />
          <LayerToggle
            label="Signalements"
            color={LAYER_COLORS.signalements}
            icon="warning-outline"
            active={activeLayers.has('signalements')}
            onPress={() => toggleLayer('signalements')}
            count={signalementsCount}
          />
          {floodData.length > 0 && (
            <LayerToggle
              label="IA"
              color={LAYER_COLORS.evenements}
              icon="flash-outline"
              active={activeLayers.has('evenements')}
              onPress={() => toggleLayer('evenements')}
              count={floodData.length}
            />
          )}
        </View>

        {/* Pin count indicator */}
        <View style={styles.pinCount}>
          <Ionicons name="location" size={14} color={Colors.primary} />
          <Text style={styles.pinCountText}>{visiblePins.length} points</Text>
        </View>

        {/* Risk check floating button */}
        <TouchableOpacity
          style={styles.riskCheckFab}
          onPress={() => router.push('/risk-check')}
          activeOpacity={0.8}
        >
          <Ionicons name="shield-checkmark" size={20} color={Colors.white} />
          <Text style={styles.riskCheckFabText}>Zone a risque ?</Text>
        </TouchableOpacity>

        {/* Legend bar at bottom */}
        <View style={styles.legendBar}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS.savoir }]} />
            <Text style={styles.legendText}>Savoir local</Text>
          </View>
          <View style={styles.legendDivider} />
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS.signalements }]} />
            <Text style={styles.legendText}>Signalement citoyen</Text>
          </View>
          {floodData.length > 0 && (
            <>
              <View style={styles.legendDivider} />
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS.evenements }]} />
                <Text style={styles.legendText}>Historique IA</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Bottom sheet modal for pin details */}
      <Modal visible={!!selectedPin} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedPin(null)}>
          <View
            style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />
            {selectedPin && (
              <PinDetail
                pin={selectedPin}
                onClose={() => setSelectedPin(null)}
                onAskAminata={handleAskAminata}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Layer toggle button component
function LayerToggle({
  label,
  color,
  icon,
  active,
  onPress,
  count,
}: {
  label: string;
  color: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  count: number;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toggleBtn,
        active && { backgroundColor: color, borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={14}
        color={active ? '#fff' : color}
      />
      <Text
        style={[
          styles.toggleLabel,
          active && { color: '#fff' },
          !active && { color },
        ]}
      >
        {label}
      </Text>
      <View style={[styles.toggleBadge, active ? { backgroundColor: 'rgba(255,255,255,0.3)' } : { backgroundColor: `${color}18` }]}>
        <Text style={[styles.toggleBadgeText, active ? { color: '#fff' } : { color }]}>
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Pin detail bottom sheet content
function PinDetail({
  pin,
  onClose,
  onAskAminata,
}: {
  pin: MapPin;
  onClose: () => void;
  onAskAminata: (titre: string) => void;
}) {
  const renderContent = () => {
    switch (pin.layer) {
      case 'savoir': {
        const m = pin.data as CarteMarker;
        if (!m) return null;

        const rawText = m.detail ?? '';
        const truncatedContent = rawText.length > 150
          ? rawText.substring(0, 150) + '...'
          : rawText || null;

        return (
          <View style={detailStyles.content}>
            <View style={detailStyles.headerRow}>
              <View style={[detailStyles.layerIndicator, { backgroundColor: LAYER_COLORS.savoir }]} />
              <Text style={detailStyles.layerLabel}>Savoir local</Text>
            </View>
            <Text style={detailStyles.title} selectable>{m.label ?? 'Sans titre'}</Text>
            {truncatedContent ? (
              <Text style={detailStyles.description} selectable>{truncatedContent}</Text>
            ) : null}
            <View style={detailStyles.metaGrid}>
              {m.porteur ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>{m.porteur}</Text>
                </View>
              ) : null}
              {m.source_type ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>
                    {m.source_type === 'entretien_terrain' ? 'Entretien terrain'
                      : m.source_type === 'signalement_citoyen' ? 'Signalement citoyen'
                      : m.source_type === 'editorial' ? 'Editorial'
                      : m.source_type}
                  </Text>
                </View>
              ) : null}
              {m.quartier ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>{m.quartier}</Text>
                </View>
              ) : null}
            </View>

            {/* Bouton "Demander à Aminata" */}
            <TouchableOpacity
              style={detailStyles.aminataBtn}
              onPress={() => onAskAminata(m.label ?? 'ce savoir')}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
              <Text style={detailStyles.aminataBtnText}>Demander a Aminata</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'signalements': {
        const m = pin.data as CarteMarker;
        if (!m) return null;

        return (
          <View style={detailStyles.content}>
            <View style={detailStyles.headerRow}>
              <View style={[detailStyles.layerIndicator, { backgroundColor: LAYER_COLORS.signalements }]} />
              <Text style={detailStyles.layerLabel}>Signalement citoyen</Text>
              {m.priorite ? <PriorityBadgeInline priorite={m.priorite} /> : null}
            </View>
            {m.label ? <Text style={detailStyles.title} selectable>{m.label}</Text> : null}
            {m.detail ? (
              <Text style={detailStyles.description} selectable>{m.detail}</Text>
            ) : null}
            <View style={detailStyles.metaGrid}>
              {m.statut ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="shield-outline" size={14} color={Colors.primary} />
                  <Text style={detailStyles.metaText}>
                    Statut : {m.statut === 'en_cours' ? 'En cours' : m.statut === 'traite' ? 'Traité' : 'Résolu'}
                  </Text>
                </View>
              ) : null}
              {m.signal_timestamp ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>
                    {formatDateFr(m.signal_timestamp)}
                  </Text>
                </View>
              ) : null}
              {m.priorite ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="flag-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>
                    Priorite : {m.priorite.charAt(0).toUpperCase() + m.priorite.slice(1)}
                  </Text>
                </View>
              ) : null}
              {m.quartier ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>{m.quartier}</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      }

      case 'evenements': {
        const f = pin.data as FloodEvent;
        if (!f) return null;

        const severityPercent = typeof f.flood_severity === 'number'
          ? Math.round(f.flood_severity * 100)
          : null;

        return (
          <View style={detailStyles.content}>
            <View style={detailStyles.headerRow}>
              <View style={[detailStyles.layerIndicator, { backgroundColor: LAYER_COLORS.evenements }]} />
              <Text style={detailStyles.layerLabel}>Evenement IA</Text>
            </View>
            {f.commune ? <Text style={detailStyles.title} selectable>{f.commune}</Text> : null}
            <View style={detailStyles.metaGrid}>
              {severityPercent != null && (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="speedometer-outline" size={14} color={LAYER_COLORS.evenements} />
                  <Text style={detailStyles.metaText}>Severite : {severityPercent}%</Text>
                </View>
              )}
              {f.event_date ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>
                    {formatDateFr(f.event_date)}
                  </Text>
                </View>
              ) : null}
              {f.data_source ? (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="server-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>Source : {f.data_source}</Text>
                </View>
              ) : null}
              {typeof f.precipitation_mm === 'number' && (
                <View style={detailStyles.metaItem}>
                  <Ionicons name="rainy-outline" size={14} color={Colors.textSecondary} />
                  <Text style={detailStyles.metaText}>Precip. : {f.precipitation_mm} mm</Text>
                </View>
              )}
            </View>

            {/* Severity bar */}
            {severityPercent != null && (
              <View style={detailStyles.severityBarContainer}>
                <View style={detailStyles.severityBarBg}>
                  <View
                    style={[
                      detailStyles.severityBarFill,
                      {
                        width: `${Math.min(severityPercent, 100)}%`,
                        backgroundColor:
                          severityPercent > 70 ? LAYER_COLORS.signalements
                          : severityPercent > 40 ? '#F57C00'
                          : LAYER_COLORS.evenements,
                      },
                    ]}
                  />
                </View>
                <Text style={detailStyles.severityLabel}>
                  {severityPercent > 70 ? 'Elevee' : severityPercent > 40 ? 'Moderee' : 'Faible'}
                </Text>
              </View>
            )}
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <View>
      <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <Ionicons name="close-circle" size={28} color={Colors.textTertiary} />
      </TouchableOpacity>
      {renderContent()}
    </View>
  );
}

// Safe date formatting helper
function formatDateFr(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// Inline priority badge
function PriorityBadgeInline({ priorite }: { priorite: string }) {
  const colorMap: Record<string, string> = {
    critique: Colors.critical,
    haute: '#E63946',
    moyenne: Colors.alert,
    faible: Colors.success,
  };
  const color = colorMap[priorite] ?? Colors.textSecondary;

  return (
    <View style={[detailStyles.priorityBadge, { backgroundColor: `${color}18` }]}>
      <View style={[detailStyles.priorityDot, { backgroundColor: color }]} />
      <Text style={[detailStyles.priorityText, { color }]}>
        {priorite.charAt(0).toUpperCase() + priorite.slice(1)}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  content: { gap: 12, paddingTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  layerIndicator: { width: 10, height: 10, borderRadius: 5 },
  layerLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.text, lineHeight: 22 },
  description: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text, lineHeight: 21, opacity: 0.85 },
  metaGrid: { gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, flex: 1 },
  aminataBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 4,
  },
  aminataBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#fff' },
  closeBtn: { position: 'absolute', top: -4, right: -4, zIndex: 10, padding: 4 },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontFamily: Fonts.semiBold, fontSize: 11 },
  severityBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  severityBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  severityBarFill: { height: '100%', borderRadius: 3 },
  severityLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textSecondary, width: 60 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mapWrapper: {
    flex: 1,
  },
  // Toggle overlay
  toggleOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1.5,
    borderColor: Colors.border,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    ...Platform.select({ android: { elevation: 3 } as object, default: {} }),
  },
  toggleLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },
  toggleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  toggleBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  // Pin count
  pinCount: {
    position: 'absolute',
    bottom: 44,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  pinCountText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  // Risk check FAB
  riskCheckFab: {
    position: 'absolute',
    bottom: 44,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    boxShadow: '0 4px 12px rgba(31, 121, 235, 0.35)',
    ...Platform.select({ android: { elevation: 4 } as object, default: {} }),
  },
  riskCheckFabText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.white,
  },
  // Legend bar
  legendBar: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  legendDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 14,
    minHeight: 220,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
    ...Platform.select({ android: { elevation: 8 } as object, default: {} }),
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
});
