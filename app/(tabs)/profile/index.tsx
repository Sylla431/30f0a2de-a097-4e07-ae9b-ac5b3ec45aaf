import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { QUARTIERS } from '@/constants/Quartiers';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import type { AgentAlerteResponse } from '@/store/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const session = useAppStore((s) => s.session);
  const profile = useAppStore((s) => s.profile);
  const setSession = useAppStore((s) => s.setSession);
  const setProfile = useAppStore((s) => s.setProfile);

  if (!session) {
    return <AuthScreen insets={insets} />;
  }

  return (
    <ProfileView
      session={session}
      profile={profile}
      setSession={setSession}
      setProfile={setProfile}
      insets={insets}
    />
  );
}

// === ADMIN AGENT BUTTON ===
function AdminAgentSection() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentAlerteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLaunchAgent = useCallback(async () => {
    try {
      setRunning(true);
      setError(null);
      setResult(null);

      const { data, error: fnError } = await withTimeout(
        supabase.functions.invoke('agent-alerte'),
        30000,
        'L\'analyse prend trop de temps. Veuillez réessayer.'
      );

      if (fnError) throw fnError;
      setResult(data as AgentAlerteResponse);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'analyse';
      setError(message);
    } finally {
      setRunning(false);
    }
  }, []);

  const niveauColor = (niveau: string) => {
    if (niveau === 'urgence') return Colors.critical;
    if (niveau === 'alerte') return Colors.alert;
    return '#F5A623';
  };

  return (
    <View style={styles.adminSection}>
      <View style={styles.adminHeader}>
        <Ionicons name="hardware-chip" size={18} color={Colors.primary} />
        <Text style={styles.adminTitle}>Agent IA Alertes</Text>
      </View>
      <Text style={styles.adminDesc}>
        Lancer l{"'"}analyse des donnees d{"'"}inondation et signalements pour generer des alertes.
      </Text>

      <TouchableOpacity
        style={[styles.agentButton, running && { opacity: 0.6 }]}
        onPress={handleLaunchAgent}
        disabled={running}
        activeOpacity={0.7}
      >
        {running ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Ionicons name="flash" size={16} color={Colors.white} />
        )}
        <Text style={styles.agentButtonText}>
          {running ? 'Analyse en cours...' : 'Lancer analyse alertes'}
        </Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.agentError}>
          <Ionicons name="alert-circle" size={14} color={Colors.critical} />
          <Text style={styles.agentErrorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.agentResult}>
          <View style={styles.agentResultHeader}>
            <Ionicons
              name={result.alertes_generees > 0 ? 'warning' : 'shield-checkmark'}
              size={16}
              color={result.alertes_generees > 0 ? Colors.alert : Colors.success}
            />
            <Text style={styles.agentResultTitle}>
              {result.alertes_generees > 0
                ? `${result.alertes_generees} alerte(s) generee(s)`
                : 'Aucune alerte detectee'}
            </Text>
          </View>

          <View style={styles.contextRow}>
            <Text style={styles.contextText}>
              Evenements: {result.contexte.flood_events_analyses} | SOS: {result.contexte.sos_recents} | Communes: {result.contexte.communes_meteo}
            </Text>
          </View>

          {result.alertes.map((alerte, idx) => (
            <View key={idx} style={[styles.agentResultItem, { borderLeftColor: niveauColor(alerte.niveau) }]}>
              <View style={styles.agentResultItemHeader}>
                <View style={[styles.miniNiveauBadge, { backgroundColor: niveauColor(alerte.niveau) }]}>
                  <Text style={styles.miniNiveauText}>{alerte.niveau.toUpperCase()}</Text>
                </View>
                <Text style={styles.agentResultCommune}>{alerte.commune}</Text>
              </View>
              <Text style={styles.agentResultMessage}>{alerte.message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// === TEST ALERT BUTTON (Admin only) ===
interface TestAlertResult {
  niveau: string;
  message: string;
  commune: string;
}

function TestAlertSection({ commune }: { commune: string }) {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [alertResult, setAlertResult] = useState<TestAlertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getNiveauConfig = (niveau: string) => {
    const upper = niveau.toUpperCase();
    if (upper === 'URGENCE') return { color: '#E63946', icon: 'alert-circle' as const, label: 'URGENCE' };
    if (upper === 'ALERTE') return { color: '#FF6B35', icon: 'warning' as const, label: 'ALERTE' };
    return { color: '#FFC107', icon: 'eye' as const, label: 'VIGILANCE' };
  };

  const handleTestAlert = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAlertResult(null);

      const { data, error: fnError } = await withTimeout(
        supabase.functions.invoke('agent-alerte', {
          body: { commune: commune || 'Commune IV', test: true },
        }),
        30000,
        'Le test d\'alerte prend trop de temps. Veuillez réessayer.'
      );

      if (fnError) throw fnError;

      if (data && data.message) {
        setAlertResult({
          niveau: data.niveau ?? 'VIGILANCE',
          message: data.message,
          commune: data.commune ?? commune ?? 'Commune IV',
        });
        setModalVisible(true);
      } else {
        throw new Error('Reponse invalide du serveur');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors du test d'alerte";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [commune]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const niveauConfig = alertResult ? getNiveauConfig(alertResult.niveau) : null;

  return (
    <View style={testStyles.section}>
      <View style={testStyles.sectionHeader}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.critical} />
        <Text style={testStyles.sectionTitle}>Administration</Text>
      </View>

      <TouchableOpacity
        style={[testStyles.testButton, loading && { opacity: 0.7 }]}
        onPress={handleTestAlert}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Ionicons name="notifications" size={18} color={Colors.white} />
        )}
        <Text style={testStyles.testButtonText}>
          {loading ? 'Test en cours...' : "Tester l'alerte IA"}
        </Text>
      </TouchableOpacity>

      {error && (
        <View style={testStyles.errorBox}>
          <Ionicons name="close-circle" size={14} color={Colors.critical} />
          <Text style={testStyles.errorText}>{error}</Text>
        </View>
      )}

      {/* Alert Result Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <Pressable style={testStyles.modalOverlay} onPress={handleCloseModal}>
          <Pressable style={testStyles.modalContent} onPress={(e) => e.stopPropagation()}>
            {niveauConfig && alertResult && (
              <View style={[testStyles.modalCard, { backgroundColor: niveauConfig.color }]}>
                {/* Header with icon and level */}
                <View style={testStyles.modalHeader}>
                  <View style={testStyles.modalIconCircle}>
                    <Ionicons name={niveauConfig.icon} size={32} color={niveauConfig.color} />
                  </View>
                  <Text style={testStyles.modalNiveau}>{niveauConfig.label}</Text>
                </View>

                {/* Commune */}
                <View style={testStyles.modalCommuneRow}>
                  <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={testStyles.modalCommune}>{alertResult.commune}</Text>
                </View>

                {/* Message from Gemini */}
                <Text style={testStyles.modalMessage} selectable>
                  {alertResult.message}
                </Text>

                {/* Close button */}
                <TouchableOpacity
                  style={testStyles.modalCloseButton}
                  onPress={handleCloseModal}
                  activeOpacity={0.8}
                >
                  <Text style={testStyles.modalCloseText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const testStyles = StyleSheet.create({
  section: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(230, 57, 70, 0.2)',
    boxShadow: '0 2px 12px rgba(230, 57, 70, 0.08)',
    ...Platform.select({ android: { elevation: 3 } as object, default: {} }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.text,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E63946',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderCurve: 'continuous',
    boxShadow: '0 4px 12px rgba(230, 57, 70, 0.3)',
    ...Platform.select({ android: { elevation: 4 } as object, default: {} }),
  },
  testButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(230, 57, 70, 0.08)',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.critical,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
  },
  modalCard: {
    borderRadius: 20,
    padding: 28,
    gap: 16,
    alignItems: 'center',
    borderCurve: 'continuous',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    ...Platform.select({ android: { elevation: 12 } as object, default: {} }),
  },
  modalHeader: {
    alignItems: 'center',
    gap: 12,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  modalNiveau: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.white,
    letterSpacing: 2,
  },
  modalCommuneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalCommune: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modalMessage: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.white,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 4,
  },
  modalCloseText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
});

// === AUTH SCREEN ===
function AuthScreen({ insets }: { insets: { top: number; bottom: number } }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }

    try {
      setLoading(true);
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        Alert.alert('Compte cree', 'Votre compte a ete cree avec succes.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur d\'authentification';
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  }, [email, password, isLogin]);

  return (
    <ScrollView
      contentContainerStyle={[styles.authContainer, { paddingTop: 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.authHeader}>
        <View style={styles.authIcon}>
          <Ionicons name="water" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.authTitle}>Alert{"'"}i Communaute</Text>
        <Text style={styles.authSubtitle}>
          {isLogin ? 'Connectez-vous pour contribuer' : 'Creez votre compte'}
        </Text>
      </View>

      <View style={styles.authForm}>
        <Text style={styles.authLabel}>Email</Text>
        <TextInput
          style={styles.authInput}
          placeholder="votre@email.com"
          placeholderTextColor={Colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={styles.authLabel}>Mot de passe</Text>
        <TextInput
          style={styles.authInput}
          placeholder="Votre mot de passe"
          placeholderTextColor={Colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.authButton, loading && { opacity: 0.6 }]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.authButtonText}>
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Creer un compte'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.authToggle}
          onPress={() => setIsLogin(!isLogin)}
          activeOpacity={0.7}
        >
          <Text style={styles.authToggleText}>
            {isLogin ? 'Pas de compte ? Inscrivez-vous' : 'Deja un compte ? Connectez-vous'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// === PROFILE VIEW ===
function ProfileView({
  session,
  profile,
  setSession,
  setProfile,
  insets,
}: {
  session: { user: { id: string; email: string } };
  profile: { id: string; nom: string | null; quartier: string | null; telephone: string | null; role: string } | null;
  setSession: (s: null) => void;
  setProfile: (p: null) => void;
  insets: { top: number; bottom: number };
}) {
  const router = useRouter();
  const unreadAlertesCount = useAppStore((s) => s.unreadAlertesCount);
  const setUnreadCount = useAppStore((s) => s.setUnreadAlertesCount);
  const [nom, setNom] = useState(profile?.nom ?? '');
  const [quartier, setQuartier] = useState(profile?.quartier ?? '');
  const [telephone, setTelephone] = useState(profile?.telephone ?? '');
  const [isEnqueteur, setIsEnqueteur] = useState(profile?.role === 'enqueteur');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ signalements: 0, savoirs: 0 });

  // Fetch unread alertes count on mount
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { count } = await withTimeout(
          supabase
            .from('alertes_ia')
            .select('id', { count: 'exact', head: true })
            .eq('lu', false),
          10000,
          'Délai dépassé lors du chargement des alertes non lues.'
        );
        setUnreadCount(count ?? 0);
      } catch {
        // Silent — non-critical count fetch
      }
    };
    fetchUnread();
  }, [setUnreadCount]);

  const fetchStats = useCallback(async () => {
    try {
      const [sosCount, knowledgeCount] = await withTimeout(
        Promise.all([
          supabase.from('sos_signals').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).then((r) => r),
          supabase.from('community_knowledge').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).then((r) => r),
        ]),
        10000,
        'Le chargement des statistiques prend trop de temps.'
      );
      setStats({
        signalements: sosCount.count ?? 0,
        savoirs: knowledgeCount.count ?? 0,
      });
    } catch {
      // Silent fail — stats are informational
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const role = isEnqueteur ? 'enqueteur' : 'resident';
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        nom: nom.trim() || null,
        quartier: quartier || null,
        telephone: telephone.trim() || null,
        role,
      });

      if (error) throw error;

      // Update local state
      const updatedProfile = {
        id: session.user.id,
        nom: nom.trim() || null,
        quartier: quartier || null,
        telephone: telephone.trim() || null,
        role,
        created_at: profile?.id ? '' : new Date().toISOString(),
      };
      useAppStore.getState().setProfile(updatedProfile as any);
      // Persist selected quartier in local preferences for map/other screens
      useAppStore.getState().setPreferences({ selectedQuartier: quartier || undefined });
      Alert.alert('Profil mis a jour', 'Vos informations ont ete sauvegardees.');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil.');
    } finally {
      setSaving(false);
    }
  }, [session.user.id, nom, quartier, telephone, isEnqueteur, profile]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [setSession, setProfile]);

  return (
    <ScrollView
      contentContainerStyle={[styles.profileContainer, { paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.profileTitle}>Mon Profil</Text>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="warning" size={22} color={Colors.alert} />
          <Text style={styles.statValue}>{stats.signalements}</Text>
          <Text style={styles.statLabel}>Signalements</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="book" size={22} color={Colors.primary} />
          <Text style={styles.statValue}>{stats.savoirs}</Text>
          <Text style={styles.statLabel}>Savoirs partages</Text>
        </View>
      </View>

      {/* Profile form */}
      <View style={styles.profileFormSection}>
        <Text style={styles.profileFormLabel}>Nom</Text>
        <TextInput
          style={styles.profileInput}
          placeholder="Votre nom"
          placeholderTextColor={Colors.textTertiary}
          value={nom}
          onChangeText={setNom}
        />

        <Text style={styles.profileFormLabel}>Email</Text>
        <View style={styles.profileInputDisabled}>
          <Text style={styles.profileInputDisabledText}>{session.user.email}</Text>
        </View>

        <Text style={styles.profileFormLabel}>Telephone</Text>
        <TextInput
          style={styles.profileInput}
          placeholder="+223 XX XX XX XX"
          placeholderTextColor={Colors.textTertiary}
          value={telephone}
          onChangeText={setTelephone}
          keyboardType="phone-pad"
        />

        <Text style={styles.profileFormLabel}>Quartier</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={styles.quartierRow}>
            {QUARTIERS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quartierProfileChip, quartier === q && styles.quartierProfileChipActive]}
                onPress={() => setQuartier(quartier === q ? '' : q)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quartierProfileChipText, quartier === q && styles.quartierProfileChipTextActive]}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Enqueteur toggle */}
        <View style={styles.enqueteurRow}>
          <View style={styles.enqueteurInfo}>
            <Text style={styles.enqueteurTitle}>Mode enqueteur</Text>
            <Text style={styles.enqueteurDesc}>Acces au formulaire d{"'"}entretien terrain</Text>
          </View>
          <Switch
            value={isEnqueteur}
            onValueChange={setIsEnqueteur}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={isEnqueteur ? Colors.primary : Colors.white}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
          <Text style={styles.saveButtonText}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Text>
        </TouchableOpacity>
      </View>

      {/* Risk Check Section */}
      <TouchableOpacity
        style={styles.alertesLink}
        onPress={() => router.push('/risk-check')}
        activeOpacity={0.7}
      >
        <View style={styles.alertesLinkLeft}>
          <View style={[styles.alertesIconWrap, { backgroundColor: 'rgba(229, 57, 53, 0.1)' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#e53935" />
          </View>
          <View style={styles.alertesLinkTextWrap}>
            <Text style={styles.alertesLinkTitle}>Suis-je en zone a risque ?</Text>
            <Text style={styles.alertesLinkDesc}>Verifiez votre position ou quartier</Text>
          </View>
        </View>
        <View style={styles.alertesLinkRight}>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* Alertes IA Section */}
      <TouchableOpacity
        style={styles.alertesLink}
        onPress={() => router.push('/(tabs)/profile/alertes-ia')}
        activeOpacity={0.7}
      >
        <View style={styles.alertesLinkLeft}>
          <View style={styles.alertesIconWrap}>
            <Ionicons name="notifications" size={20} color={Colors.primary} />
          </View>
          <View style={styles.alertesLinkTextWrap}>
            <Text style={styles.alertesLinkTitle}>Alertes IA</Text>
            <Text style={styles.alertesLinkDesc}>Alertes inondation generees par l{"'"}IA</Text>
          </View>
        </View>
        <View style={styles.alertesLinkRight}>
          {unreadAlertesCount > 0 && (
            <View style={styles.alertesBadge}>
              <Text style={styles.alertesBadgeText}>{unreadAlertesCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* Government Dashboard Section */}
      <TouchableOpacity
        style={[styles.alertesLink, { borderLeftColor: Colors.primary, borderLeftWidth: 4 }]}
        onPress={() => router.push('/gov-dashboard')}
        activeOpacity={0.7}
      >
        <View style={styles.alertesLinkLeft}>
          <View style={[styles.alertesIconWrap, { backgroundColor: 'rgba(31, 121, 235, 0.1)' }]}>
            <Ionicons name="business" size={20} color={Colors.primary} />
          </View>
          <View style={styles.alertesLinkTextWrap}>
            <Text style={styles.alertesLinkTitle}>Espace Gouvernemental</Text>
            <Text style={styles.alertesLinkDesc}>Supervision et gestion de crise en temps reel</Text>
          </View>
        </View>
        <View style={styles.alertesLinkRight}>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Admin section - only visible for admin role */}
      {profile?.role === 'admin' && <AdminAgentSection />}

      {/* Test Alert section - only visible for admin role */}
      {profile?.role === 'admin' && (
        <TestAlertSection commune={profile?.quartier ?? 'Commune IV'} />
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={Colors.critical} />
        <Text style={styles.logoutButtonText}>Se deconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Auth styles
  authContainer: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  authHeader: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  authIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.text,
  },
  authSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  authForm: {
    gap: 12,
  },
  authLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  authInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  authButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.white,
  },
  authToggle: {
    alignItems: 'center',
    padding: 12,
  },
  authToggleText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.primary,
  },
  // Profile styles
  profileContainer: {
    padding: 20,
    gap: 16,
  },
  profileTitle: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  statValue: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  profileFormSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  profileFormLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  profileInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  profileInputDisabled: {
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    padding: 12,
  },
  profileInputDisabledText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  quartierRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  quartierProfileChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  quartierProfileChipActive: {
    backgroundColor: Colors.primary,
  },
  quartierProfileChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  quartierProfileChipTextActive: {
    color: Colors.white,
  },
  enqueteurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  enqueteurInfo: {
    flex: 1,
    gap: 2,
  },
  enqueteurTitle: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text,
  },
  enqueteurDesc: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  saveButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.critical,
  },
  logoutButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.critical,
  },
  // Alertes link
  alertesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  alertesLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  alertesIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertesLinkTextWrap: {
    gap: 2,
  },
  alertesLinkTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  alertesLinkDesc: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  alertesLinkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertesBadge: {
    backgroundColor: Colors.critical,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  alertesBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.white,
    fontVariant: ['tabular-nums'],
  },
  // Admin section
  adminSection: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.05)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  adminDesc: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  agentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 13,
    borderRadius: 10,
  },
  agentButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.white,
  },
  agentError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.critical}10`,
    padding: 10,
    borderRadius: 8,
  },
  agentErrorText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.critical,
    flex: 1,
  },
  agentResult: {
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
  },
  agentResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentResultTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.text,
  },
  contextRow: {
    paddingVertical: 4,
  },
  contextText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  agentResultItem: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    borderLeftWidth: 3,
  },
  agentResultItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniNiveauBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniNiveauText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  agentResultCommune: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.text,
  },
  agentResultMessage: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
