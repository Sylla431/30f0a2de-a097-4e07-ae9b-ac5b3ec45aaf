import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { QUARTIERS } from '@/constants/Quartiers';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import { LoadingState } from '@/components/loading-state';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';
import { AuthRequiredModal } from '@/components/auth-required-modal';
import type { CommunityKnowledge, Conseil } from '@/store/types';

type TabKey = 'partager' | 'entretien' | 'conseils';

const KNOWLEDGE_TYPES = [
  { value: 'savoir', label: 'Savoir local' },
  { value: 'observation', label: 'Observation' },
  { value: 'pratique', label: 'Pratique' },
  { value: 'risque', label: 'Zone a risque' },
];

const CONSEIL_TYPES = [
  { value: null, label: 'Tous' },
  { value: 'prevention', label: 'Prevention' },
  { value: 'evacuation', label: 'Evacuation' },
  { value: 'apres_inondation', label: 'Apres crue' },
  { value: 'sante', label: 'Sante' },
  { value: 'infrastructure', label: 'Infrastructure' },
];

export default function KnowledgeScreen() {
  const session = useAppStore((s) => s.session);
  const profile = useAppStore((s) => s.profile);
  const [activeTab, setActiveTab] = useState<TabKey>('partager');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Savoir Communautaire</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'partager' && styles.tabActive]}
          onPress={() => setActiveTab('partager')}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={16} color={activeTab === 'partager' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'partager' && styles.tabTextActive]}>Partager</Text>
        </TouchableOpacity>
        {profile?.role === 'enqueteur' && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'entretien' && styles.tabActive]}
            onPress={() => setActiveTab('entretien')}
            activeOpacity={0.7}
          >
            <Ionicons name="clipboard-outline" size={16} color={activeTab === 'entretien' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'entretien' && styles.tabTextActive]}>Entretien</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'conseils' && styles.tabActive]}
          onPress={() => setActiveTab('conseils')}
          activeOpacity={0.7}
        >
          <Ionicons name="bulb-outline" size={16} color={activeTab === 'conseils' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'conseils' && styles.tabTextActive]}>Conseils</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'partager' && <ShareTab session={session} profile={profile} />}
      {activeTab === 'entretien' && <InterviewTab session={session} />}
      {activeTab === 'conseils' && <ConseilsTab />}
    </View>
  );
}

// === SHARE TAB ===
function ShareTab({ session, profile }: { session: { user: { id: string } } | null; profile: { quartier: string | null } | null }) {
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [quartier, setQuartier] = useState(profile?.quartier ?? '');
  const [type, setType] = useState('savoir');
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [recentKnowledge, setRecentKnowledge] = useState<CommunityKnowledge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await withTimeout(
        supabase
          .from('community_knowledge')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
        15000,
        'Le chargement des savoirs prend trop de temps.'
      );
      setRecentKnowledge(data ?? []);
    } catch {
      // Silent fail for listing — data may load on retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const handleSubmit = useCallback(async () => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    if (!titre.trim()) {
      Alert.alert('Titre requis', 'Veuillez donner un titre a votre contribution.');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('community_knowledge').insert({
        user_id: session.user.id,
        titre: titre.trim(),
        description: description.trim() || null,
        quartier: quartier || null,
        type,
      });

      if (error) throw error;
      Alert.alert('Merci !', 'Votre savoir a ete partage avec la communaute.');
      setTitre('');
      setDescription('');
      fetchRecent();
    } catch {
      Alert.alert('Erreur', 'Impossible de partager. Reessayez.');
    } finally {
      setSubmitting(false);
    }
  }, [session, titre, description, quartier, type, fetchRecent]);

  return (
    <>
    <AuthRequiredModal
      visible={showAuthModal}
      onDismiss={() => setShowAuthModal(false)}
    />
    <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
      {/* Form */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Partager un savoir</Text>

        <Text style={styles.formLabel}>Titre *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Zone inondable pres du marche"
          placeholderTextColor={Colors.textTertiary}
          value={titre}
          onChangeText={setTitre}
        />

        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Decrivez votre observation ou savoir..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        <Text style={styles.formLabel}>Type</Text>
        <View style={styles.typeRow}>
          {KNOWLEDGE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeChip, type === t.value && styles.typeChipActive]}
              onPress={() => setType(t.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>Quartier</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={styles.quartierFormRow}>
            {QUARTIERS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quartierChip, quartier === q && styles.quartierChipActive]}
                onPress={() => setQuartier(quartier === q ? '' : q)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quartierChipText, quartier === q && styles.quartierChipTextActive]}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={18} color={Colors.white} />
          <Text style={styles.submitBtnText}>
            {submitting ? 'Envoi...' : 'Partager avec la communaute'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent knowledge */}
      <Text style={styles.sectionTitle}>Contributions recentes</Text>
      {loading ? (
        <LoadingState message="Chargement..." />
      ) : recentKnowledge.length === 0 ? (
        <EmptyState icon="book-outline" title="Aucun savoir partage" />
      ) : (
        recentKnowledge.map((item) => (
          <View key={item.id} style={styles.knowledgeCard}>
            <View style={styles.knowledgeHeader}>
              <View style={[styles.knowledgeBadge, { backgroundColor: `${Colors.primary}12` }]}>
                <Text style={styles.knowledgeBadgeText}>
                  {item.type === 'savoir' ? 'Savoir' : item.type === 'observation' ? 'Observation' : item.type === 'pratique' ? 'Pratique' : 'Risque'}
                </Text>
              </View>
              {item.quartier && <Text style={styles.knowledgeQuartier}>{item.quartier}</Text>}
            </View>
            <Text style={styles.knowledgeTitle}>{item.titre}</Text>
            {item.description && <Text style={styles.knowledgeDesc} numberOfLines={2}>{item.description}</Text>}
          </View>
        ))
      )}
    </ScrollView>
    </>
  );
}

// === INTERVIEW TAB (Wizard 7 blocs) ===
function InterviewTab({ session }: { session: { user: { id: string } } | null }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Form data
  const [nomInterviewe, setNomInterviewe] = useState('');
  const [quartier, setQuartier] = useState('');
  const [age, setAge] = useState('');
  const [dureeResidence, setDureeResidence] = useState('');
  const [historique, setHistorique] = useState('');
  const [signes, setSignes] = useState('');
  const [zones, setZones] = useState('');
  const [pratiques, setPratiques] = useState('');
  const [ressources, setRessources] = useState('');
  const [recommandations, setRecommandations] = useState('');

  const STEPS = [
    'Identification',
    'Historique inondations',
    'Signes precurseurs',
    'Zones a risque',
    'Pratiques d\'adaptation',
    'Ressources et reseaux',
    'Recommandations',
  ];

  const canAdvance = useMemo(() => {
    if (step === 0) return nomInterviewe.trim().length > 0;
    return true;
  }, [step, nomInterviewe]);

  const handleSubmit = useCallback(async () => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('field_interviews').insert({
        enqueteur_id: session.user.id,
        nom_interviewe: nomInterviewe.trim(),
        quartier: quartier || null,
        age: age ? parseInt(age, 10) : null,
        duree_residence: dureeResidence ? parseInt(dureeResidence, 10) : null,
        historique_inondations: historique ? [{ text: historique }] : [],
        signes_precurseurs: signes ? [{ text: signes }] : [],
        zones_risque: zones ? [{ text: zones }] : [],
        pratiques_adaptation: pratiques ? [{ text: pratiques }] : [],
        ressources_reseaux: ressources ? [{ text: ressources }] : [],
        recommandations: recommandations.trim() || null,
      });

      if (error) throw error;
      Alert.alert('Entretien enregistre', 'Les donnees ont ete sauvegardees.');
      // Reset
      setStep(0);
      setNomInterviewe('');
      setQuartier('');
      setAge('');
      setDureeResidence('');
      setHistorique('');
      setSignes('');
      setZones('');
      setPratiques('');
      setRessources('');
      setRecommandations('');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'entretien.');
    } finally {
      setSubmitting(false);
    }
  }, [session, nomInterviewe, quartier, age, dureeResidence, historique, signes, zones, pratiques, ressources, recommandations]);

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.formLabel}>Nom de l{"'"}interviewe *</Text>
            <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor={Colors.textTertiary} value={nomInterviewe} onChangeText={setNomInterviewe} />
            <Text style={styles.formLabel}>Quartier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={styles.quartierFormRow}>
                {QUARTIERS.map((q) => (
                  <TouchableOpacity key={q} style={[styles.quartierChip, quartier === q && styles.quartierChipActive]} onPress={() => setQuartier(quartier === q ? '' : q)} activeOpacity={0.7}>
                    <Text style={[styles.quartierChipText, quartier === q && styles.quartierChipTextActive]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.formLabel}>Age</Text>
            <TextInput style={styles.input} placeholder="Age" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" value={age} onChangeText={setAge} />
            <Text style={styles.formLabel}>Duree de residence (annees)</Text>
            <TextInput style={styles.input} placeholder="Nombre d'annees" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" value={dureeResidence} onChangeText={setDureeResidence} />
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Quelles inondations avez-vous vecues ? Quand ? Quelle ampleur ?</Text>
            <TextInput style={styles.textArea} placeholder="Decrivez les inondations passees..." placeholderTextColor={Colors.textTertiary} multiline value={historique} onChangeText={setHistorique} textAlignVertical="top" />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Quels signes annoncent une inondation dans votre quartier ?</Text>
            <TextInput style={styles.textArea} placeholder="Montee de l'eau, couleur du ciel, comportement des animaux..." placeholderTextColor={Colors.textTertiary} multiline value={signes} onChangeText={setSignes} textAlignVertical="top" />
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Quelles zones sont les plus dangereuses en cas d{"'"}inondation ?</Text>
            <TextInput style={styles.textArea} placeholder="Rues, quartiers, points bas..." placeholderTextColor={Colors.textTertiary} multiline value={zones} onChangeText={setZones} textAlignVertical="top" />
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Comment vous adaptez-vous aux inondations ? Quelles pratiques ?</Text>
            <TextInput style={styles.textArea} placeholder="Surelever les meubles, sacs de sable, evacuation precoce..." placeholderTextColor={Colors.textTertiary} multiline value={pratiques} onChangeText={setPratiques} textAlignVertical="top" />
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Quels reseaux d{"'"}entraide existent ? Quelles ressources ?</Text>
            <TextInput style={styles.textArea} placeholder="Associations, leaders, lieux de refuge..." placeholderTextColor={Colors.textTertiary} multiline value={ressources} onChangeText={setRessources} textAlignVertical="top" />
          </View>
        );
      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Quelles recommandations feriez-vous pour ameliorer la preparation ?</Text>
            <TextInput style={styles.textArea} placeholder="Vos recommandations..." placeholderTextColor={Colors.textTertiary} multiline value={recommandations} onChangeText={setRecommandations} textAlignVertical="top" />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <>
    <AuthRequiredModal
      visible={showAuthModal}
      onDismiss={() => setShowAuthModal(false)}
    />
    <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 7) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Etape {step + 1}/7 - {STEPS[step]}</Text>
      </View>

      {renderStepContent()}

      {/* Navigation buttons */}
      <View style={styles.wizardNav}>
        {step > 0 && (
          <TouchableOpacity style={styles.navBtnBack} onPress={() => setStep(step - 1)} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={Colors.primary} />
            <Text style={styles.navBtnBackText}>Retour</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {step < 6 ? (
          <TouchableOpacity
            style={[styles.navBtnNext, !canAdvance && { opacity: 0.5 }]}
            onPress={() => canAdvance && setStep(step + 1)}
            disabled={!canAdvance}
            activeOpacity={0.7}
          >
            <Text style={styles.navBtnNextText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtnNext, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={18} color={Colors.white} />
            <Text style={styles.navBtnNextText}>{submitting ? 'Envoi...' : 'Terminer'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    </>
  );
}

// === CONSEILS TAB ===
function ConseilsTab() {
  const [conseils, setConseils] = useState<Conseil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchConseils = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('conseils')
          .select('*')
          .order('ordre', { ascending: true }),
        15000,
        'Le chargement des conseils prend trop de temps.'
      );
      if (fetchError) throw fetchError;
      setConseils(data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les conseils';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConseils();
  }, [fetchConseils]);

  const filteredConseils = useMemo(() => {
    if (!filterType) return conseils;
    return conseils.filter((c) => c.type === filterType);
  }, [conseils, filterType]);

  if (loading) return <LoadingState message="Chargement des conseils..." />;
  if (error) return <ErrorState message={error} onRetry={fetchConseils} />;

  return (
    <FlatList
      data={filteredConseils}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.conseilsList}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={styles.conseilFilterRow}>
            {CONSEIL_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value ?? 'all'}
                style={[styles.conseilFilterChip, filterType === t.value && styles.conseilFilterChipActive]}
                onPress={() => setFilterType(t.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.conseilFilterText, filterType === t.value && styles.conseilFilterTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      }
      renderItem={({ item }) => (
        <View style={styles.conseilCard}>
          <View style={styles.conseilHeader}>
            <View style={[styles.conseilBadge, {
              backgroundColor: item.type === 'prevention' ? `${Colors.primary}14` :
                item.type === 'evacuation' ? `${Colors.alert}14` :
                item.type === 'sante' ? `${Colors.critical}14` :
                item.type === 'infrastructure' ? `${Colors.success}14` :
                `${Colors.textSecondary}14`
            }]}>
              <Ionicons
                name={item.type === 'prevention' ? 'shield-checkmark' : item.type === 'evacuation' ? 'exit-outline' : item.type === 'sante' ? 'medkit' : item.type === 'infrastructure' ? 'construct' : 'information-circle'}
                size={14}
                color={item.type === 'prevention' ? Colors.primary : item.type === 'evacuation' ? Colors.alert : item.type === 'sante' ? Colors.critical : item.type === 'infrastructure' ? Colors.success : Colors.textSecondary}
              />
              <Text style={[styles.conseilBadgeText, {
                color: item.type === 'prevention' ? Colors.primary : item.type === 'evacuation' ? Colors.alert : item.type === 'sante' ? Colors.critical : item.type === 'infrastructure' ? Colors.success : Colors.textSecondary
              }]}>
                {item.type === 'prevention' ? 'Prevention' : item.type === 'evacuation' ? 'Evacuation' : item.type === 'apres_inondation' ? 'Apres crue' : item.type === 'sante' ? 'Sante' : 'Infrastructure'}
              </Text>
            </View>
          </View>
          <Text style={styles.conseilTitle}>{item.titre}</Text>
          <Text style={styles.conseilContent}>{item.contenu}</Text>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="bulb-outline" title="Aucun conseil pour ce filtre" />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 1 } as object, default: {} }),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: `${Colors.primary}10` },
  tabText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontFamily: Fonts.semiBold },
  // Form styles
  formContent: { padding: 16, gap: 14, paddingBottom: 40 },
  formSection: { gap: 12 },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text, marginTop: 8 },
  formLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text },
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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.white },
  quartierFormRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  quartierChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quartierChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quartierChipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  quartierChipTextActive: { color: Colors.white },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 12,
    marginTop: 8,
  },
  submitBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white },
  // Knowledge card
  knowledgeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    boxShadow: '0 2px 6px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 1 } as object, default: {} }),
  },
  knowledgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  knowledgeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  knowledgeBadgeText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.primary },
  knowledgeQuartier: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary },
  knowledgeTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text },
  knowledgeDesc: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  // Interview wizard
  progressContainer: { gap: 6 },
  progressBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  stepContent: { gap: 12 },
  stepDescription: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },
  wizardNav: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  navBtnBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  navBtnBackText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.primary },
  navBtnNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  navBtnNextText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  // Conseils
  conseilsList: { padding: 16, gap: 12, paddingBottom: 40 },
  conseilFilterRow: { flexDirection: 'row', gap: 6, paddingBottom: 8 },
  conseilFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  conseilFilterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  conseilFilterText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  conseilFilterTextActive: { color: Colors.white },
  conseilCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    boxShadow: '0 2px 6px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 1 } as object, default: {} }),
  },
  conseilHeader: { flexDirection: 'row', alignItems: 'center' },
  conseilBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  conseilBadgeText: { fontFamily: Fonts.medium, fontSize: 11 },
  conseilTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text },
  conseilContent: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
