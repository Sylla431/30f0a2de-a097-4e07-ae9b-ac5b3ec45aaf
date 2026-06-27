import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { QUARTIERS } from '@/constants/Quartiers';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import { LoadingState } from '@/components/loading-state';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';
import { PriorityBadge } from '@/components/priority-badge';
import { AuthRequiredModal } from '@/components/auth-required-modal';
import type { SosSignal } from '@/store/types';

const SOS_TYPES = [
  { value: 'inondation', label: 'Inondation', icon: 'water' as const },
  { value: 'glissement', label: 'Glissement', icon: 'trending-down' as const },
  { value: 'route_coupee', label: 'Route coupee', icon: 'car' as const },
  { value: 'autre', label: 'Autre', icon: 'alert-circle' as const },
];

const PRIORITES = [
  { value: 'faible', label: 'Faible' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'haute', label: 'Haute' },
  { value: 'critique', label: 'Critique' },
];

export default function SosScreen() {
  const insets = useSafeAreaInsets();
  const session = useAppStore((s) => s.session);
  const profile = useAppStore((s) => s.profile);
  const [signals, setSignals] = useState<SosSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formType, setFormType] = useState<string>('inondation');
  const [formPriorite, setFormPriorite] = useState<string>('moyenne');
  const [formDescription, setFormDescription] = useState('');
  const [formQuartier, setFormQuartier] = useState<string>(profile?.quartier ?? '');
  const [formSignePrecurseur, setFormSignePrecurseur] = useState('');
  const [formNiveauEau, setFormNiveauEau] = useState('');

  const fetchSignals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('sos_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        15000,
        'Le chargement des signalements prend trop de temps. Vérifiez votre connexion.'
      );

      if (fetchError) throw fetchError;
      setSignals(data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les signalements';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel('sos-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sos_signals' },
          (payload) => {
            try {
              setSignals((prev) => [payload.new as SosSignal, ...prev]);
            } catch {
              // Ignore malformed payloads
            }
          }
        )
        .subscribe();
    } catch {
      // Realtime subscription failed — non-critical
    }

    return () => {
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {
          // Cleanup failure — non-critical
        }
      }
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!session) {
      setShowForm(false);
      setShowAuthModal(true);
      return;
    }

    if (!formDescription.trim()) {
      Alert.alert('Champ requis', 'Veuillez decrire la situation.');
      return;
    }

    try {
      setSubmitting(true);
      const { error: insertError } = await supabase.from('sos_signals').insert({
        user_id: session.user.id,
        type: formType,
        priorite: formPriorite,
        description: formDescription.trim(),
        quartier: formQuartier || null,
        signe_precurseur: formSignePrecurseur.trim() || null,
        niveau_eau_estime: formNiveauEau ? parseInt(formNiveauEau, 10) : null,
        latitude: 12.6392 + (Math.random() - 0.5) * 0.08,
        longitude: -8.0029 + (Math.random() - 0.5) * 0.08,
      });

      if (insertError) throw insertError;

      setShowForm(false);
      setFormType('inondation');
      setFormPriorite('moyenne');
      setFormDescription('');
      setFormSignePrecurseur('');
      setFormNiveauEau('');
      Alert.alert('Signalement envoye', 'Votre alerte a ete transmise avec succes.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le signalement. Reessayez.');
    } finally {
      setSubmitting(false);
    }
  }, [session, formType, formPriorite, formDescription, formQuartier, formSignePrecurseur, formNiveauEau]);

  const getTimeAgo = useCallback((dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }, []);

  const renderSignal = useCallback(({ item }: { item: SosSignal }) => (
    <View style={styles.signalCard}>
      <View style={styles.signalHeader}>
        <View style={styles.signalTypeRow}>
          <View style={[styles.signalIcon, {
            backgroundColor: item.priorite === 'critique' || item.priorite === 'haute'
              ? `${Colors.critical}14` : `${Colors.alert}14`
          }]}>
            <Ionicons
              name={item.type === 'inondation' ? 'water' : item.type === 'glissement' ? 'trending-down' : item.type === 'route_coupee' ? 'car' : 'alert-circle'}
              size={18}
              color={item.priorite === 'critique' || item.priorite === 'haute' ? Colors.critical : Colors.alert}
            />
          </View>
          <View style={styles.signalMeta}>
            <Text style={styles.signalType}>
              {item.type === 'inondation' ? 'Inondation' :
               item.type === 'glissement' ? 'Glissement' :
               item.type === 'route_coupee' ? 'Route coupee' : 'Autre'}
            </Text>
            <Text style={styles.signalTime}>{getTimeAgo(item.created_at)}</Text>
          </View>
        </View>
        <PriorityBadge priorite={item.priorite} />
      </View>
      {item.description && (
        <Text style={styles.signalDescription} numberOfLines={2}>{item.description}</Text>
      )}
      <View style={styles.signalFooter}>
        {item.quartier && (
          <View style={styles.signalLocation}>
            <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.signalLocationText}>{item.quartier}</Text>
          </View>
        )}
        {item.niveau_eau_estime !== null && (
          <View style={styles.signalLocation}>
            <Ionicons name="water-outline" size={13} color={Colors.primary} />
            <Text style={styles.signalLocationText}>{item.niveau_eau_estime}cm</Text>
          </View>
        )}
      </View>
    </View>
  ), [getTimeAgo]);

  if (loading) return <LoadingState message="Chargement des alertes..." />;
  if (error) return <ErrorState message={error} onRetry={fetchSignals} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Signalements</Text>
          <Text style={styles.headerSubtitle}>{signals.length} signalements actifs</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (!session) {
              setShowAuthModal(true);
            } else {
              setShowForm(true);
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
          <Text style={styles.addButtonText}>Signaler</Text>
        </TouchableOpacity>
      </View>

      {/* Live indicator */}
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Temps reel</Text>
      </View>

      <FlatList
        data={signals}
        keyExtractor={(item) => item.id}
        renderItem={renderSignal}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="shield-checkmark-outline"
            title="Aucun signalement"
            description="La zone est calme. Signalez un incident si necessaire."
          />
        }
      />

      {/* Auth required modal */}
      <AuthRequiredModal
        visible={showAuthModal}
        onDismiss={() => setShowAuthModal(false)}
      />

      {/* New signal form modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.formContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.formTitle}>Nouveau signalement</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
            {/* Type selector */}
            <Text style={styles.formLabel}>Type d{"'"}incident</Text>
            <View style={styles.typeGrid}>
              {SOS_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeCard, formType === t.value && styles.typeCardActive]}
                  onPress={() => setFormType(t.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={t.icon}
                    size={22}
                    color={formType === t.value ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.typeCardText, formType === t.value && styles.typeCardTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Priority selector */}
            <Text style={styles.formLabel}>Priorite</Text>
            <View style={styles.priorityRow}>
              {PRIORITES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.priorityChip, formPriorite === p.value && styles.priorityChipActive]}
                  onPress={() => setFormPriorite(p.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.priorityChipText, formPriorite === p.value && styles.priorityChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.formLabel}>Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Decrivez la situation..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              value={formDescription}
              onChangeText={setFormDescription}
              textAlignVertical="top"
            />

            {/* Quartier */}
            <Text style={styles.formLabel}>Quartier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={styles.quartierFormRow}>
                {QUARTIERS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.quartierFormChip, formQuartier === q && styles.quartierFormChipActive]}
                    onPress={() => setFormQuartier(formQuartier === q ? '' : q)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quartierFormChipText, formQuartier === q && styles.quartierFormChipTextActive]}>
                      {q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Signe precurseur */}
            <Text style={styles.formLabel}>Signe precurseur</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: montee rapide de l'eau, pluie intense..."
              placeholderTextColor={Colors.textTertiary}
              value={formSignePrecurseur}
              onChangeText={setFormSignePrecurseur}
            />

            {/* Niveau d'eau */}
            <Text style={styles.formLabel}>Niveau d{"'"}eau estime (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 30"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              value={formNiveauEau}
              onChangeText={setFormNiveauEau}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={18} color={Colors.white} />
              <Text style={styles.submitButtonText}>
                {submitting ? 'Envoi en cours...' : 'Envoyer le signalement'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.alert,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.white,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.success,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  signalCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signalTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalMeta: {
    gap: 2,
  },
  signalType: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  signalTime: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  signalDescription: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  signalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  signalLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  signalLocationText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  // Form styles
  formContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  formTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  formContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  formLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  typeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  typeCardText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  typeCardTextActive: {
    color: Colors.primary,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  priorityChipActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  priorityChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  priorityChipTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
  },
  textArea: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quartierFormRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  quartierFormChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quartierFormChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quartierFormChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  quartierFormChipTextActive: {
    color: Colors.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.alert,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.white,
  },
});
