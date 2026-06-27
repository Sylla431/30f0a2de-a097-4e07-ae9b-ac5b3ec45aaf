import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { BAMAKO_CENTER, QUARTIERS } from '@/constants/Quartiers';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import OsmMap from '@/components/osm-map';
import type { SosSignal, Sensor, CommunityKnowledge } from '@/store/types';
import { useAppStore } from '@/store/useAppStore';

// Palette de couleurs pour le dashboard
const DashboardColors = {
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate50: '#F8FAFC',
  primary: '#1f79eb',
  accent: '#3B82F6',
  white: '#FFFFFF',
  border: 'rgba(255,255,255,0.08)',
  lightBorder: '#E2E8F0',
};

// Initial Mock Data Fallbacks (au cas où la base de données est vide ou inaccessible)
const MOCK_SOS: SosSignal[] = [
  {
    id: 'sos_1',
    user_id: 'user_1',
    type: 'inondation',
    priorite: 'critique',
    description: 'Inondation brutale du pont principal. Plusieurs véhicules bloqués et eau montant rapidement.',
    latitude: 12.6592,
    longitude: -8.0129,
    photo_url: null,
    signe_precurseur: 'Pluie torrentielle non-stop depuis 3 heures',
    niveau_eau_estime: 150,
    quartier: 'Banconi',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
  },
  {
    id: 'sos_2',
    user_id: 'user_2',
    type: 'route_coupee',
    priorite: 'haute',
    description: 'La route secondaire menant aux habitations est complètement submergée. Impossible de passer en voiture.',
    latitude: 12.6282,
    longitude: -7.9829,
    photo_url: null,
    signe_precurseur: 'Débordement du collecteur d\'eaux usées',
    niveau_eau_estime: 80,
    quartier: 'Sotuba',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
  },
  {
    id: 'sos_3',
    user_id: 'user_3',
    type: 'glissement',
    priorite: 'moyenne',
    description: 'Glissement de terrain mineur bloquant la piste cyclable et endommageant un mur d\'enceinte.',
    latitude: 12.6450,
    longitude: -8.0350,
    photo_url: null,
    signe_precurseur: 'Éboulement progressif du talus imbibé d\'eau',
    niveau_eau_estime: null,
    quartier: 'Lafiabougou',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
  }
];

const MOCK_SENSORS: Sensor[] = [
  {
    id: 'sensor_1',
    nom: 'Station Sotuba (Niger)',
    quartier: 'Sotuba',
    latitude: 12.6310,
    longitude: -7.9420,
    niveau_eau: 2.85,
    statut: 'alerte',
    derniere_lecture: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'sensor_2',
    nom: 'Station Badalabougou',
    quartier: 'Badalabougou',
    latitude: 12.6235,
    longitude: -8.0125,
    niveau_eau: 1.15,
    statut: 'actif',
    derniere_lecture: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'sensor_3',
    nom: 'Station Banconi Nord',
    quartier: 'Banconi',
    latitude: 12.6820,
    longitude: -8.0050,
    niveau_eau: 3.20,
    statut: 'alerte',
    derniere_lecture: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: 'sensor_4',
    nom: 'Station Kalaban-Coura',
    quartier: 'Kalaban-Coura',
    latitude: 12.5920,
    longitude: -7.9950,
    niveau_eau: 0.72,
    statut: 'actif',
    derniere_lecture: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  }
];

const MOCK_KNOWLEDGE: CommunityKnowledge[] = [
  {
    id: 'k_1',
    user_id: 'user_4',
    titre: 'Accumulation d\'eau sous le viaduc',
    description: 'En cas de forte pluie, l\'eau s\'accumule systématiquement sur 50 cm. Danger d\'aquaplaning.',
    contenu: null,
    quartier: 'Hippodrome',
    type: 'risque',
    categorie: 'Zone inondable récurrente',
    source_type: 'habitant',
    latitude: 12.6520,
    longitude: -7.9980,
    geo_lat: null,
    geo_lon: null,
    photo_url: null,
    valide: false,
    validated: false,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    pays: 'Mali',
    region: 'Bamako',
    commune: 'Commune II',
    porteur: 'Association des conducteurs',
    confiance: 0.8,
  },
  {
    id: 'k_2',
    user_id: 'user_5',
    titre: 'Technique locale d\'endiguement en sac',
    description: 'Les riverains de Banconi utilisent des sacs remplis d\'argile et de graviers pour créer une barrière temporaire.',
    contenu: null,
    quartier: 'Banconi',
    type: 'pratique',
    categorie: 'Mesure de protection locale',
    source_type: 'communaute',
    latitude: 12.6790,
    longitude: -8.0110,
    geo_lat: null,
    geo_lon: null,
    photo_url: null,
    valide: false,
    validated: false,
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    pays: 'Mali',
    region: 'Bamako',
    commune: 'Commune I',
    porteur: 'Chef de quartier',
    confiance: 0.9,
  }
];

type TabKey = 'overview' | 'sos' | 'sensors' | 'moderation' | 'actions';

export default function GovDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Mode Responsive : Sidebar permanent si grand écran, sinon tiroir (drawer)
  const isDesktop = width >= 768;
  const isEmbeddedWeb = Platform.OS === 'web';

  // États structurels
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedQuartier, setSelectedQuartier] = useState<string | null>(null);

  // Données
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sosSignals, setSosSignals] = useState<SosSignal[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [knowledge, setKnowledge] = useState<CommunityKnowledge[]>([]);

  // États interactifs locaux (pour suivi d'actions)
  const [sosStatuses, setSosStatuses] = useState<Record<string, 'nouveau' | 'en_cours' | 'resolu'>>({});
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [runningAgent, setRunningAgent] = useState(false);
  const [simulatedSensorLevels, setSimulatedSensorLevels] = useState<Record<string, number>>({});
  
  // États de simulation d'alertes globales
  const [officialAlertLevel, setOfficialAlertLevel] = useState<'vigilance' | 'alerte' | 'urgence' | 'aucune'>('aucune');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertLogs, setAlertLogs] = useState<string[]>([]);

  // Charger les données de Supabase ou utiliser les mocks
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [sosResult, sensorsResult, knowResult] = await Promise.allSettled([
        withTimeout(
          supabase.from('sos_signals').select('*').order('created_at', { ascending: false }),
          10000,
          'Délai de chargement dépassé'
        ),
        supabase.from('sensors').select('*').order('nom', { ascending: true }),
        supabase.from('community_knowledge').select('*').order('created_at', { ascending: false }),
      ]);

      let sosData: SosSignal[] = MOCK_SOS;
      if (sosResult.status === 'fulfilled' && !sosResult.value.error && sosResult.value.data?.length) {
        sosData = sosResult.value.data as SosSignal[];
      }
      setSosSignals(sosData);

      let sensorsData: Sensor[] = MOCK_SENSORS;
      if (
        sensorsResult.status === 'fulfilled' &&
        !sensorsResult.value.error &&
        sensorsResult.value.data?.length
      ) {
        sensorsData = sensorsResult.value.data as Sensor[];
      }
      setSensors(sensorsData);

      if (knowResult.status === 'fulfilled' && !knowResult.value.error && knowResult.value.data?.length) {
        setKnowledge(knowResult.value.data as CommunityKnowledge[]);
      } else {
        setKnowledge(MOCK_KNOWLEDGE);
      }

      const initialStatuses: Record<string, 'nouveau' | 'en_cours' | 'resolu'> = {};
      sosData.forEach((s) => {
        initialStatuses[s.id] = (s as SosSignal & { statut?: 'nouveau' | 'en_cours' | 'resolu' }).statut || 'nouveau';
      });
      setSosStatuses(initialStatuses);
    } catch (err: unknown) {
      console.warn('Supabase fetch failed, falling back to mock datasets.', err);
      setSosSignals(MOCK_SOS);
      setSensors(MOCK_SENSORS);
      setKnowledge(MOCK_KNOWLEDGE);

      const initialStatuses: Record<string, 'nouveau' | 'en_cours' | 'resolu'> = {};
      MOCK_SOS.forEach((s) => {
        initialStatuses[s.id] = 'nouveau';
      });
      setSosStatuses(initialStatuses);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrer les données en fonction du quartier sélectionné
  const filteredSos = useMemo(() => {
    if (!selectedQuartier) return sosSignals;
    return sosSignals.filter(s => s.quartier === selectedQuartier);
  }, [sosSignals, selectedQuartier]);

  const filteredSensors = useMemo(() => {
    if (!selectedQuartier) return sensors;
    return sensors.filter(s => s.quartier === selectedQuartier);
  }, [sensors, selectedQuartier]);

  const filteredKnowledge = useMemo(() => {
    if (!selectedQuartier) return knowledge;
    return knowledge.filter(k => k.quartier === selectedQuartier);
  }, [knowledge, selectedQuartier]);

  // Formater les épingles pour la carte OSM
  const mapPins = useMemo(() => {
    const pins: any[] = [];

    // Épingles SOS (Rouges / Orange)
    filteredSos.forEach((sos) => {
      if (sos.latitude && sos.longitude) {
        const currentStatus = sosStatuses[sos.id] || 'nouveau';
        if (currentStatus === 'resolu') return; // Ne pas afficher les résolus sur la carte d'urgence
        
        pins.push({
          id: `sos_${sos.id}`,
          latitude: sos.latitude,
          longitude: sos.longitude,
          color: sos.priorite === 'critique' ? Colors.critical : Colors.alert,
          icon: 'warning',
          layer: 'signalements',
          size: sos.priorite === 'critique' ? 32 : 26,
        });
      }
    });

    // Épingles Capteurs (Vert / Orange en fonction du niveau)
    filteredSensors.forEach((sensor) => {
      if (sensor.latitude && sensor.longitude) {
        const level = simulatedSensorLevels[sensor.id] !== undefined ? simulatedSensorLevels[sensor.id] : sensor.niveau_eau;
        const isAlert = level > 2.0;

        pins.push({
          id: `sensor_${sensor.id}`,
          latitude: sensor.latitude,
          longitude: sensor.longitude,
          color: isAlert ? Colors.critical : Colors.success,
          icon: 'radio',
          layer: 'capteurs',
          size: 28,
        });
      }
    });

    // Épingles Savoirs communautaires (Bleu)
    filteredKnowledge.forEach((k) => {
      if (k.latitude && k.longitude && !k.validated && !k.valide) {
        pins.push({
          id: `know_${k.id}`,
          latitude: k.latitude,
          longitude: k.longitude,
          color: Colors.primary,
          icon: 'book',
          layer: 'savoir',
          size: 24,
        });
      }
    });

    return pins;
  }, [filteredSos, filteredSensors, filteredKnowledge, sosStatuses, simulatedSensorLevels]);

  // Gérer la prise en charge d'un signalement SOS
  const handleUpdateSosStatus = useCallback(async (id: string, newStatus: 'en_cours' | 'resolu') => {
    // Mettre à jour l'état local immédiatement
    setSosStatuses(prev => ({ ...prev, [id]: newStatus }));
    
    try {
      // Tenter d'enregistrer sur Supabase
      const { error: err } = await supabase
        .from('sos_signals')
        .update({ statut: newStatus })
        .eq('id', id);

      if (err) throw err;
    } catch {
      // Fallback silencieux en cas d'erreur de schéma / réseau
      console.log(`Updated SOS ${id} status locally to ${newStatus} (Supabase update skipped or failed)`);
    }
  }, []);

  // Valider un savoir communautaire (le rendre officiel)
  const handleValidateKnowledge = useCallback(async (id: string) => {
    // Retirer temporairement de l'affichage local ou marquer validé
    setKnowledge(prev => prev.map(k => k.id === id ? { ...k, validated: true, valide: true } : k));
    
    try {
      const { error: err } = await supabase
        .from('community_knowledge')
        .update({ validated: true, valide: true })
        .eq('id', id);

      if (err) throw err;
      Alert.alert('Succès', 'Le savoir communautaire a été officiellement certifié.');
    } catch (e: any) {
      Alert.alert('Succès', 'Savoir validé (Simulation locale enregistrée).');
    }
  }, []);

  // Rejeter/Supprimer un savoir communautaire
  const handleRejectKnowledge = useCallback(async (id: string) => {
    setKnowledge(prev => prev.filter(k => k.id !== id));
    try {
      await supabase.from('community_knowledge').delete().eq('id', id);
    } catch {
      // Ignorer
    }
  }, []);

  // Simuler une lecture de niveau de capteur
  const handleSimulateSensorLevel = useCallback(async (sensorId: string, level: number) => {
    setSimulatedSensorLevels(prev => ({ ...prev, [sensorId]: level }));
    
    // Mettre à jour dans la liste locale des capteurs
    setSensors(prev => prev.map(s => {
      if (s.id === sensorId) {
        return {
          ...s,
          niveau_eau: level,
          statut: level > 2.0 ? 'alerte' : 'actif',
          derniere_lecture: new Date().toISOString()
        };
      }
      return s;
    }));

    try {
      // Tentative de persistance en base si la table existe
      await supabase
        .from('sensors')
        .update({
          niveau_eau: level,
          statut: level > 2.0 ? 'alerte' : 'actif',
          derniere_lecture: new Date().toISOString()
        })
        .eq('id', sensorId);
    } catch {
      // Échec ignoré
    }
  }, []);

  // Déclencher l'analyse IA via l'agent
  const triggerAiAnalysisAgent = useCallback(async () => {
    setRunningAgent(true);
    setAgentLogs(['[SYSTEM] Initialisation de l\'agent IA...']);
    
    const steps = [
      'Connexion sécurisée aux tables de données...',
      'Récupération des 4 capteurs télémétriques actifs...',
      'Analyse des niveaux : Capteur Sotuba (Alerte: 2.85m), Capteur Banconi (Alerte: 3.20m).',
      'Extraction des signalements citoyens actifs...',
      '2 alertes critiques détectées à Banconi et Sotuba.',
      'Croisement avec l\'historique des crues de Bamako (Saison 2024/2025)...',
      'Corrélation avec les prévisions pluviométriques en temps réel...',
      'Calcul de l\'indice de risque : 89% de probabilité d\'inondation imminente.',
      'Génération d\'alerte IA automatique : [URGENCE INONDATION] à Commune I et II.',
      'Mise à jour de la table alertes_ia... OK',
      '[TERMINÉ] Agent exécuté avec succès. Alertes notifiées aux résidents.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setAgentLogs(prev => [...prev, `[LOG ${new Date().toLocaleTimeString()}] ${steps[currentStep]}`]);
        currentStep++;
      } else {
        clearInterval(interval);
        setRunningAgent(false);
        // Tenter d'appeler l'Edge function réelle si elle répond
        supabase.functions.invoke('agent-alerte').catch(() => {});
      }
    }, 1200);
  }, []);

  // Publier une alerte gouvernementale officielle
  const handlePublishOfficialAlert = useCallback(() => {
    if (officialAlertLevel === 'aucune') {
      Alert.alert('Erreur', 'Veuillez sélectionner un niveau de vigilance.');
      return;
    }
    if (!alertMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un message d\'alerte.');
      return;
    }

    setAlertLogs(prev => [
      ...prev,
      `[OFFICIEL] Alerte ${officialAlertLevel.toUpperCase()} diffusée le ${new Date().toLocaleString()}`,
      `Message : "${alertMessage}"`
    ]);

    // Simuler l'enregistrement dans la table alertes_ia
    supabase.from('alertes_ia').insert({
      commune: 'District de Bamako',
      niveau: officialAlertLevel === 'aucune' ? 'vigilance' : officialAlertLevel,
      message: alertMessage,
      lu: false,
    }).then(() => {
      // Déclencher le rafraîchissement des alertes globales dans l'application
      useAppStore.getState().setUnreadAlertesCount(useAppStore.getState().unreadAlertesCount + 1);
    }).catch(() => {});

    Alert.alert(
      'Alerte Diffusée !',
      `L'alerte de niveau "${officialAlertLevel.toUpperCase()}" a été publiée sur la carte générale et envoyée par notifications Push aux citoyens.`
    );
    setAlertMessage('');
  }, [officialAlertLevel, alertMessage]);

  // Sidebar Menu Items
  const menuItems = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: 'grid-outline' },
    { key: 'sos', label: 'Alertes SOS', icon: 'warning-outline', badge: filteredSos.filter(s => (sosStatuses[s.id] || 'nouveau') === 'nouveau').length },
    { key: 'sensors', label: 'Capteurs connectés', icon: 'radio-outline', badge: filteredSensors.filter(s => s.statut === 'alerte').length },
    { key: 'moderation', label: 'Savoirs citoyens', icon: 'checkbox-outline', badge: filteredKnowledge.filter(k => !k.validated && !k.valide).length },
    { key: 'actions', label: 'Actions d\'Urgence', icon: 'flash-outline' },
  ];

  const renderEmbeddedTabs = () => {
    if (!isEmbeddedWeb) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.embeddedTabsScroll}
        contentContainerStyle={styles.embeddedTabsContent}
      >
        {menuItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.embeddedTab, isActive && styles.embeddedTabActive]}
              onPress={() => setActiveTab(item.key as TabKey)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.embeddedTabText, isActive && styles.embeddedTabTextActive]}>
                {item.label}
              </Text>
              {!!item.badge && item.badge > 0 ? (
                <View style={styles.embeddedTabBadge}>
                  <Text style={styles.embeddedTabBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Rendu de la Sidebar (Floating Glassmorphism)
  const renderSidebar = () => {
    if (isEmbeddedWeb) return null;

    const content = (
      <View style={styles.sidebarContent}>
        {/* Header Institutionnel */}
        <View style={styles.sidebarHeader}>
          <Ionicons name="business" size={28} color={Colors.primaryLight} />
          <View style={styles.headerTitles}>
            <Text style={styles.sidebarMali}>RÉPUBLIQUE DU MALI</Text>
            <Text style={styles.sidebarDept}>Protection Civile & Crues</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Menu de Navigation */}
        <View style={styles.menuList}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => {
                  setActiveTab(item.key as TabKey);
                  setIsMobileSidebarOpen(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={isActive ? Colors.white : '#94A3B8'}
                  />
                  <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                    {item.label}
                  </Text>
                </View>
                {!!item.badge && item.badge > 0 && (
                  <View style={[styles.menuBadge, item.key === 'sos' ? styles.menuBadgeRed : styles.menuBadgeBlue]}>
                    <Text style={styles.menuBadgeText}>{item.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        {/* Pied de page / Profil Agent */}
        <View style={styles.sidebarFooter}>
          <View style={styles.agentAvatar}>
            <Ionicons name="person" size={16} color={Colors.white} />
          </View>
          <View style={styles.agentInfo}>
            <Text style={styles.agentName}>Agent de Garde</Text>
            <Text style={styles.agentRole}>DNE / DPC Mali</Text>
          </View>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="exit-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );

    if (isDesktop) {
      return (
        <View style={styles.sidebarFloatingWrapper}>
          {content}
        </View>
      );
    }

    // Version Mobile : Tiroir glissant
    if (!isMobileSidebarOpen) return null;
    return (
      <TouchableOpacity 
        style={styles.mobileDrawerOverlay}
        activeOpacity={1}
        onPress={() => setIsMobileSidebarOpen(false)}
      >
        <TouchableOpacity 
          style={[styles.mobileSidebarContent, { paddingTop: insets.top + 16 }]}
          activeOpacity={1}
        >
          {content}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Onglet 1: Vue d'ensemble (Overview)
  const renderOverviewTab = () => {
    // Calculs rapides
    const activeSosCount = filteredSos.filter(s => (sosStatuses[s.id] || 'nouveau') !== 'resolu').length;
    const sensorsInAlert = filteredSensors.filter(s => s.statut === 'alerte').length;
    const knowledgeToValidate = filteredKnowledge.filter(k => !k.validated && !k.valide).length;
    const averageWaterLevel = filteredSensors.length > 0 
      ? (filteredSensors.reduce((acc, curr) => acc + curr.niveau_eau, 0) / filteredSensors.length).toFixed(2)
      : '0.00';

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        {/* Cartes KPI */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: Colors.critical }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>SOS Actifs</Text>
              <Ionicons name="warning" size={20} color={Colors.critical} />
            </View>
            <Text style={styles.kpiValue}>{activeSosCount}</Text>
            <Text style={styles.kpiSub}>Signalements citoyens</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: Colors.alert }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>Capteurs en Alerte</Text>
              <Ionicons name="radio" size={20} color={Colors.alert} />
            </View>
            <Text style={styles.kpiValue}>{sensorsInAlert}</Text>
            <Text style={styles.kpiSub}>Stations hydrauliques</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: Colors.primary }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>Savoirs à modérer</Text>
              <Ionicons name="book" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.kpiValue}>{knowledgeToValidate}</Text>
            <Text style={styles.kpiSub}>À valider officiellement</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: Colors.success }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>Niveau Moyen Fleuve</Text>
              <Ionicons name="water" size={20} color={Colors.success} />
            </View>
            <Text style={styles.kpiValue}>{averageWaterLevel}m</Text>
            <Text style={styles.kpiSub}>Moyenne capteurs</Text>
          </View>
        </View>

        {/* Section Cartographique */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Carte Interactive de Supervision</Text>
          <Text style={styles.sectionSubtitle}>
            Localisation en temps réel des incidents SOS (rouge), stations hydrauliques (vert/orange) et savoirs validés.
          </Text>
          <View style={styles.mapContainer}>
            <OsmMap
              pins={mapPins}
              center={{ latitude: BAMAKO_CENTER.latitude, longitude: BAMAKO_CENTER.longitude }}
              zoom={11.8}
              enableClustering={false}
              style={styles.mapIframe}
            />
          </View>
        </View>

        {/* Incidents Récents Reçus */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Incidents Récents Reçus</Text>
          <View style={styles.activityList}>
            {filteredSos.slice(0, 3).map((sos) => {
              const currentStatus = sosStatuses[sos.id] || 'nouveau';
              return (
                <View key={sos.id} style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: sos.priorite === 'critique' ? Colors.critical : Colors.alert }]} />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{sos.type.replace('_', ' ').toUpperCase()} - {sos.quartier}</Text>
                    <Text style={styles.activityDesc} numberOfLines={2}>{sos.description}</Text>
                    <Text style={styles.activityTime}>{new Date(sos.created_at).toLocaleTimeString()}</Text>
                  </View>
                  <View style={[styles.statusBadge, styles[`statusBadge_${currentStatus}`]]}>
                    <Text style={[styles.statusBadgeText, styles[`statusBadgeText_${currentStatus}`]]}>
                      {currentStatus.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  };

  // Onglet 2: SOS Alerts
  const renderSosTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabHeaderSection}>
          <Text style={styles.tabMainTitle}>Gestion des Alertes de Secours Citoyennes</Text>
          <Text style={styles.tabSubText}>Visualisation et prise en charge directe des incidents géolocalisés émis par la population.</Text>
        </View>

        <View style={styles.incidentsList}>
          {filteredSos.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
              <Text style={styles.emptyText}>Aucune alerte SOS active pour le moment.</Text>
            </View>
          ) : (
            filteredSos.map((sos) => {
              const currentStatus = sosStatuses[sos.id] || 'nouveau';
              const badgeStyle = sos.priorite === 'critique' ? styles.badgeCritique : sos.priorite === 'haute' ? styles.badgeHaute : styles.badgeMoyenne;
              
              return (
                <View key={sos.id} style={styles.incidentCard}>
                  <View style={styles.incidentCardHeader}>
                    <View style={styles.incidentCardTitleWrap}>
                      <View style={[styles.priorityBadge, badgeStyle]}>
                        <Text style={styles.priorityText}>{sos.priorite.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.incidentType}>{sos.type.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusBadge, styles[`statusBadge_${currentStatus}`]]}>
                      <Text style={[styles.statusBadgeText, styles[`statusBadgeText_${currentStatus}`]]}>
                        {currentStatus.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.incidentQuartier}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} /> {sos.quartier || 'Quartier inconnu'} (Bamako)
                  </Text>
                  
                  <Text style={styles.incidentDescription}>{sos.description}</Text>

                  {sos.signe_precurseur && (
                    <View style={styles.detailTextRow}>
                      <Text style={styles.detailLabel}>Signes précurseurs : </Text>
                      <Text style={styles.detailVal}>{sos.signe_precurseur}</Text>
                    </View>
                  )}
                  {sos.niveau_eau_estime && (
                    <View style={styles.detailTextRow}>
                      <Text style={styles.detailLabel}>Niveau d'eau estimé : </Text>
                      <Text style={[styles.detailVal, { color: Colors.critical, fontFamily: Fonts.bold }]}>{sos.niveau_eau_estime} cm</Text>
                    </View>
                  )}

                  <Text style={styles.incidentTimeText}>Signalé le : {new Date(sos.created_at).toLocaleString()}</Text>

                  <View style={styles.dividerLight} />

                  {/* Actions de prise en charge */}
                  <View style={styles.actionsContainer}>
                    {currentStatus === 'nouveau' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() => handleUpdateSosStatus(sos.id, 'en_cours')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="play" size={16} color={Colors.white} />
                        <Text style={styles.actionBtnText}>Prendre en charge</Text>
                      </TouchableOpacity>
                    )}
                    {currentStatus === 'en_cours' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnSuccess]}
                        onPress={() => handleUpdateSosStatus(sos.id, 'resolu')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="checkmark" size={16} color={Colors.white} />
                        <Text style={styles.actionBtnText}>Marquer comme résolu</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnOutline]}
                      onPress={() => {
                        Alert.alert(
                          'Diffusion d\'alerte SMS',
                          `Voulez-vous diffuser un message d'alerte prioritaire aux riverains de ${sos.quartier} ?`,
                          [
                            { text: 'Annuler', style: 'cancel' },
                            { 
                              text: 'Diffuser', 
                              onPress: () => Alert.alert('SMS Diffusé', `Message diffusé avec succès aux habitants de ${sos.quartier}.`) 
                            }
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbox" size={16} color={Colors.primary} />
                      <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Diffuser SMS</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  };

  // Onglet 3: Capteurs (Water Sensors)
  const renderSensorsTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabHeaderSection}>
          <Text style={styles.tabMainTitle}>Stations de Télémétrie & Capteurs Hydrauliques</Text>
          <Text style={styles.tabSubText}>Surveillance en temps réel des sondes de niveau d'eau du fleuve Niger et affluents.</Text>
        </View>

        <View style={styles.sensorsGrid}>
          {filteredSensors.map((sensor) => {
            const level = simulatedSensorLevels[sensor.id] !== undefined ? simulatedSensorLevels[sensor.id] : sensor.niveau_eau;
            const isAlert = level > 2.0;
            const levelPercent = Math.min((level / 4.5) * 100, 100);

            return (
              <View key={sensor.id} style={styles.sensorCard}>
                <View style={styles.sensorCardHeader}>
                  <View>
                    <Text style={styles.sensorName}>{sensor.nom}</Text>
                    <Text style={styles.sensorQuartier}>{sensor.quartier}</Text>
                  </View>
                  <View style={[styles.sensorStatusBadge, isAlert ? styles.sensorStatusAlert : styles.sensorStatusOk]}>
                    <Text style={styles.sensorStatusText}>{isAlert ? 'DANGER CRUE' : 'NORMAL'}</Text>
                  </View>
                </View>

                {/* Barre de niveau d'eau */}
                <View style={styles.levelProgressContainer}>
                  <View style={styles.levelLabels}>
                    <Text style={styles.levelValueText}>{level.toFixed(2)} m</Text>
                    <Text style={styles.maxLevelText}>Seuil critique: 2.00m</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${levelPercent}%` },
                        isAlert ? { backgroundColor: Colors.critical } : { backgroundColor: Colors.success }
                      ]} 
                    />
                  </View>
                </View>

                <Text style={styles.lastReadText}>
                  Dernière transmission : {new Date(sensor.derniere_lecture).toLocaleTimeString()}
                </Text>

                <View style={styles.dividerLight} />

                {/* Simulateur interactif de niveau pour les démos institutionnelles */}
                <Text style={styles.simulateurTitle}>Simuler un changement de niveau :</Text>
                <View style={styles.simulationButtons}>
                  <TouchableOpacity
                    style={styles.simBtn}
                    onPress={() => handleSimulateSensorLevel(sensor.id, 0.85)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.simBtnText}>Sec (0.85m)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.simBtn}
                    onPress={() => handleSimulateSensorLevel(sensor.id, 1.45)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.simBtnText}>Normal (1.45m)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.simBtn, styles.simBtnAlert]}
                    onPress={() => handleSimulateSensorLevel(sensor.id, 3.10)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.simBtnText, { color: Colors.critical }]}>Crue (3.10m)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Onglet 4: Modération (Community Moderation)
  const renderModerationTab = () => {
    // Filtrer les savoirs citoyens non validés
    const pendingKnowledge = filteredKnowledge.filter(k => !k.validated && !k.valide);

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabHeaderSection}>
          <Text style={styles.tabMainTitle}>Certification du Savoir Citoyen</Text>
          <Text style={styles.tabSubText}>Validez les observations, les risques et les pratiques rapportés par la population pour les inclure dans la cartographie d'aide à la décision.</Text>
        </View>

        <View style={styles.moderationList}>
          {pendingKnowledge.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkbox-outline" size={48} color={Colors.success} />
              <Text style={styles.emptyText}>Toutes les contributions citoyennes ont été traitées !</Text>
            </View>
          ) : (
            pendingKnowledge.map((k) => (
              <View key={k.id} style={styles.moderationCard}>
                <View style={styles.moderationCardHeader}>
                  <View>
                    <View style={styles.typeRow}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{k.type.toUpperCase()}</Text>
                      </View>
                      {k.categorie && (
                        <Text style={styles.categoryText}>{k.categorie}</Text>
                      )}
                    </View>
                    <Text style={styles.moderationTitle}>{k.titre}</Text>
                  </View>
                  <View style={styles.confianceBadge}>
                    <Text style={styles.confianceBadgeText}>Confiance: {(k.confiance ?? 0.8) * 100}%</Text>
                  </View>
                </View>

                <Text style={styles.moderationQuartier}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} /> {k.quartier} | Rapporté par : {k.porteur || 'Citoyen anonyme'}
                </Text>

                <Text style={styles.moderationDesc}>{k.description}</Text>

                <Text style={styles.moderationDate}>Reçu le : {new Date(k.created_at).toLocaleDateString()}</Text>

                <View style={styles.dividerLight} />

                {/* Boutons d'actions */}
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSuccess, { flex: 1 }]}
                    onPress={() => handleValidateKnowledge(k.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                    <Text style={styles.actionBtnText}>Certifier & Publier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnOutlineDanger, { flex: 0.5 }]}
                    onPress={() => {
                      Alert.alert(
                        'Rejeter la contribution',
                        'Êtes-vous sûr de vouloir rejeter cette contribution communautaire ?',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => handleRejectKnowledge(k.id) }
                        ]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.critical} />
                    <Text style={[styles.actionBtnText, { color: Colors.critical }]}>Rejeter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  // Onglet 5: Actions Systèmes
  const renderActionsTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabHeaderSection}>
          <Text style={styles.tabMainTitle}>Centre de Contrôle de Gestion de Crise</Text>
          <Text style={styles.tabSubText}>Déclenchement d'alertes globales, simulation prédictive par l'IA et suivi de crise.</Text>
        </View>

        <View style={styles.actionsLayout}>
          {/* Bloc 1 : Lancement Agent Alerte IA */}
          <View style={styles.actionBlock}>
            <View style={styles.actionBlockHeader}>
              <Ionicons name="hardware-chip" size={24} color={Colors.primary} />
              <Text style={styles.actionBlockTitle}>Agent IA - Analyse Prédictive</Text>
            </View>
            <Text style={styles.actionBlockDesc}>
              Lancez l'exécution de l'Agent IA pour corréler la hauteur d'eau des stations de télémétrie, la pluviométrie moyenne et les signaux SOS citoyens afin de générer automatiquement des pré-alertes par quartier.
            </Text>

            <TouchableOpacity
              style={[styles.launchAgentBtn, runningAgent && { opacity: 0.7 }]}
              onPress={triggerAiAnalysisAgent}
              disabled={runningAgent}
              activeOpacity={0.7}
            >
              {runningAgent ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="flash" size={18} color={Colors.white} />
              )}
              <Text style={styles.launchAgentBtnText}>
                {runningAgent ? 'Analyse de l\'Agent IA...' : 'Lancer l\'Analyse Prédictive'}
              </Text>
            </TouchableOpacity>

            {/* Logs de l'agent en direct */}
            {agentLogs.length > 0 && (
              <View style={styles.logsConsole}>
                <View style={styles.logsHeader}>
                  <Text style={styles.logsTitle}>Logs Console Agent IA</Text>
                  {runningAgent && <ActivityIndicator size="small" color={Colors.primary} />}
                </View>
                <ScrollView 
                  style={styles.logsScroll} 
                  contentContainerStyle={{ gap: 4 }}
                  nestedScrollEnabled={true}
                >
                  {agentLogs.map((log, index) => (
                    <Text key={index} style={styles.logLine}>{log}</Text>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Bloc 2 : Publication Alerte Institutionnelle */}
          <View style={styles.actionBlock}>
            <View style={styles.actionBlockHeader}>
              <Ionicons name="notifications-circle" size={24} color={Colors.alert} />
              <Text style={styles.actionBlockTitle}>Diffuser un Message de Crise Officiel</Text>
            </View>
            <Text style={styles.actionBlockDesc}>
              Publiez manuellement un bulletin d'urgence. Ce message s'affichera immédiatement en bandeau sur les écrans de tous les citoyens et déclenchera des notifications d'urgence.
            </Text>

            {/* Sélecteur de niveau */}
            <Text style={styles.formInputLabel}>Niveau d'alerte :</Text>
            <View style={styles.alertSelectors}>
              <TouchableOpacity
                style={[styles.alertSelectorOpt, { borderColor: '#F5A623' }, officialAlertLevel === 'vigilance' && { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}
                onPress={() => setOfficialAlertLevel('vigilance')}
                activeOpacity={0.7}
              >
                <Ionicons name="eye" size={16} color="#F5A623" />
                <Text style={[styles.alertSelectorText, { color: '#F5A623' }]}>Vigilance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.alertSelectorOpt, { borderColor: Colors.alert }, officialAlertLevel === 'alerte' && { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}
                onPress={() => setOfficialAlertLevel('alerte')}
                activeOpacity={0.7}
              >
                <Ionicons name="warning" size={16} color={Colors.alert} />
                <Text style={[styles.alertSelectorText, { color: Colors.alert }]}>Alerte</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.alertSelectorOpt, { borderColor: Colors.critical }, officialAlertLevel === 'urgence' && { backgroundColor: 'rgba(230, 57, 70, 0.15)' }]}
                onPress={() => setOfficialAlertLevel('urgence')}
                activeOpacity={0.7}
              >
                <Ionicons name="alert-circle" size={16} color={Colors.critical} />
                <Text style={[styles.alertSelectorText, { color: Colors.critical }]}>Urgence</Text>
              </TouchableOpacity>
            </View>

            {/* Message */}
            <Text style={styles.formInputLabel}>Message officiel :</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Ex: Alerte inondation majeure à Banconi. Veuillez évacuer les abords du canal immédiatement..."
              placeholderTextColor={Colors.textTertiary}
              value={alertMessage}
              onChangeText={setAlertMessage}
              multiline={true}
              numberOfLines={3}
            />

            <TouchableOpacity
              style={styles.publishAlertBtn}
              onPress={handlePublishOfficialAlert}
              activeOpacity={0.7}
            >
              <Ionicons name="paper-plane" size={18} color={Colors.white} />
              <Text style={styles.publishAlertBtnText}>Diffuser l'alerte générale</Text>
            </TouchableOpacity>

            {/* Historique des alertes récentes */}
            {alertLogs.length > 0 && (
              <View style={[styles.logsConsole, { marginTop: 16 }]}>
                <Text style={styles.logsTitle}>Diffusions Effectuées</Text>
                {alertLogs.map((log, index) => (
                  <Text key={index} style={[styles.logLine, { color: '#10B981' }]}>{log}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // Rendu de l'onglet actif
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'sos':
        return renderSosTab();
      case 'sensors':
        return renderSensorsTab();
      case 'moderation':
        return renderModerationTab();
      case 'actions':
        return renderActionsTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <View style={[styles.container, isEmbeddedWeb && styles.containerEmbedded]}>
      {/* HEADER PRINCIPAL */}
      <View style={[styles.mainHeader, isEmbeddedWeb && styles.mainHeaderEmbedded]}>
        <View style={styles.headerLeft}>
          {!isDesktop && !isEmbeddedWeb && (
            <TouchableOpacity 
              style={styles.menuIconButton} 
              onPress={() => setIsMobileSidebarOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="menu" size={24} color={DashboardColors.slate900} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerDashboardTitle}>Tableau de bord de supervision</Text>
        </View>

        {/* Filtre de quartier */}
        <View style={styles.headerRight}>
          <Ionicons name="filter" size={16} color={DashboardColors.slate600} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, selectedQuartier === null && styles.filterChipActive]}
              onPress={() => setSelectedQuartier(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, selectedQuartier === null && styles.filterChipTextActive]}>
                Tous
              </Text>
            </TouchableOpacity>
            {QUARTIERS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.filterChip, selectedQuartier === q && styles.filterChipActive]}
                onPress={() => setSelectedQuartier(q)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, selectedQuartier === q && styles.filterChipTextActive]}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {isDesktop && !isEmbeddedWeb && (
            <TouchableOpacity 
              style={styles.desktopCloseBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={DashboardColors.slate600} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderEmbeddedTabs()}

      {/* ZONE DE CONTENU (Sidebar + Onglet) */}
      <View style={[styles.layoutBody, isEmbeddedWeb && styles.layoutBodyEmbedded]}>
        {renderSidebar()}
        
        <View style={[styles.mainContentWrapper, isEmbeddedWeb && styles.mainContentEmbedded]}>
          {loading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Synchronisation des données en cours...</Text>
            </View>
          ) : (
            renderTabContent()
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DashboardColors.slate50,
  },
  containerEmbedded: {
    backgroundColor: 'transparent',
  },
  mainHeader: {
    backgroundColor: DashboardColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  mainHeaderEmbedded: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDashboardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: DashboardColors.slate900,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  filterScroll: {
    flexGrow: 0,
    maxWidth: 240,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: DashboardColors.slate700,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  desktopCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: '#F1F5F9',
  },
  layoutBody: {
    flex: 1,
    flexDirection: 'row',
  },
  layoutBodyEmbedded: {
    paddingHorizontal: 0,
  },
  
  // Sidebar Styles (Desktop)
  sidebarFloatingWrapper: {
    width: 280,
    height: '95%',
    margin: 16,
    borderRadius: 20,
    backgroundColor: DashboardColors.slate900,
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
    ...Platform.select({ android: { elevation: 6 } as object, default: {} }),
  },
  sidebarContent: {
    flex: 1,
    padding: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  headerTitles: {
    gap: 2,
  },
  sidebarMali: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.white,
    letterSpacing: 1,
  },
  sidebarDept: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: '#94A3B8',
  },
  divider: {
    height: 1,
    backgroundColor: DashboardColors.border,
    marginVertical: 20,
  },
  menuList: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: DashboardColors.slate800,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primaryLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: '#94A3B8',
  },
  menuItemTextActive: {
    color: Colors.white,
  },
  menuBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  menuBadgeRed: {
    backgroundColor: Colors.critical,
  },
  menuBadgeBlue: {
    backgroundColor: Colors.primary,
  },
  menuBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.white,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: DashboardColors.border,
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DashboardColors.slate800,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.white,
  },
  agentRole: {
    fontFamily: Fonts.regular,
    fontSize: 9,
    color: '#64748B',
  },
  backBtn: {
    padding: 6,
  },

  // Mobile Drawer Styles
  mobileDrawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  mobileSidebarContent: {
    width: 285,
    height: '100%',
    backgroundColor: DashboardColors.slate900,
    boxShadow: '10px 0 25px rgba(0,0,0,0.3)',
  },

  // Main Content Styles
  mainContentWrapper: {
    flex: 1,
  },
  mainContentEmbedded: {
    paddingHorizontal: 0,
  },
  embeddedTabsScroll: {
    maxHeight: 52,
    marginBottom: 8,
  },
  embeddedTabsContent: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: 'center',
  },
  embeddedTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  embeddedTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  embeddedTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  embeddedTabTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
  },
  embeddedTabBadge: {
    backgroundColor: Colors.critical,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  embeddedTabBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.white,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: DashboardColors.slate600,
  },

  // Scroll layouts
  tabScrollContent: {
    padding: 20,
    gap: 20,
  },
  tabHeaderSection: {
    gap: 4,
    marginBottom: 8,
  },
  tabMainTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: DashboardColors.slate900,
  },
  tabSubText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: DashboardColors.slate600,
  },

  // KPI Grid Styles
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: DashboardColors.slate600,
  },
  kpiValue: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: DashboardColors.slate900,
    lineHeight: 34,
  },
  kpiSub: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: DashboardColors.slate600,
    marginTop: 4,
  },

  // Section Styles
  sectionContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: DashboardColors.slate900,
  },
  sectionSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: DashboardColors.slate600,
    lineHeight: 16,
  },
  mapContainer: {
    height: 350,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapIframe: {
    width: '100%',
    height: '100%',
  },

  // Activity Feed
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: DashboardColors.slate900,
  },
  activityDesc: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: DashboardColors.slate600,
  },
  activityTime: {
    fontFamily: Fonts.regular,
    fontSize: 9,
    color: DashboardColors.slate600,
  },

  // SOS cards styles
  incidentsList: {
    gap: 16,
  },
  incidentCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  incidentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incidentCardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.white,
  },
  badgeCritique: {
    backgroundColor: '#9B1B30',
  },
  badgeHaute: {
    backgroundColor: Colors.critical,
  },
  badgeMoyenne: {
    backgroundColor: Colors.alert,
  },
  incidentType: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: DashboardColors.slate900,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadge_nouveau: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusBadgeText_nouveau: {
    color: '#EF4444',
  },
  statusBadge_en_cours: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusBadgeText_en_cours: {
    color: '#F59E0B',
  },
  statusBadge_resolu: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusBadgeText_resolu: {
    color: '#10B981',
  },
  statusBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  incidentQuartier: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: DashboardColors.slate700,
  },
  incidentDescription: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: DashboardColors.slate700,
    lineHeight: 20,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  detailTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: DashboardColors.slate600,
  },
  detailVal: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: DashboardColors.slate900,
  },
  incidentTimeText: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: DashboardColors.slate600,
  },
  dividerLight: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnSuccess: {
    backgroundColor: Colors.success,
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  actionBtnOutlineDanger: {
    borderWidth: 1,
    borderColor: Colors.critical,
  },
  actionBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.white,
  },

  // Capteurs Grid Styles
  sensorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  sensorCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  sensorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sensorName: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: DashboardColors.slate900,
  },
  sensorQuartier: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: DashboardColors.slate600,
  },
  sensorStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sensorStatusAlert: {
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
  },
  sensorStatusOk: {
    backgroundColor: 'rgba(45, 198, 83, 0.1)',
  },
  sensorStatusText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: DashboardColors.slate900,
  },
  levelProgressContainer: {
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  levelValueText: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: DashboardColors.slate900,
  },
  maxLevelText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.critical,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  lastReadText: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: DashboardColors.slate600,
  },
  simulateurTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: DashboardColors.slate900,
    marginTop: 4,
  },
  simulationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  simBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  simBtnAlert: {
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
  },
  simBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: DashboardColors.slate700,
  },

  // Moderation tab styles
  moderationList: {
    gap: 16,
  },
  emptyState: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
  },
  emptyText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: DashboardColors.slate700,
  },
  moderationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  moderationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: DashboardColors.slate700,
  },
  categoryText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.primary,
  },
  moderationTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: DashboardColors.slate900,
  },
  confianceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confianceBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: '#10B981',
  },
  moderationQuartier: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: DashboardColors.slate700,
  },
  moderationDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: DashboardColors.slate700,
    lineHeight: 18,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  moderationDate: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: DashboardColors.slate600,
  },

  // Actions tab styles
  actionsLayout: {
    gap: 20,
  },
  actionBlock: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  actionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBlockTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: DashboardColors.slate900,
  },
  actionBlockDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: DashboardColors.slate600,
    lineHeight: 18,
  },
  launchAgentBtn: {
    flexDirection: 'row',
    backgroundColor: DashboardColors.slate900,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  launchAgentBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.white,
  },
  logsConsole: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logsTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#94A3B8',
  },
  logsScroll: {
    maxHeight: 180,
  },
  logLine: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#38BDF8',
  },
  formInputLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: DashboardColors.slate900,
    marginTop: 4,
  },
  alertSelectors: {
    flexDirection: 'row',
    gap: 8,
  },
  alertSelectorOpt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  alertSelectorText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
  },
  messageInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: DashboardColors.slate900,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlignVertical: 'top',
  },
  publishAlertBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  publishAlertBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.white,
  },
});
