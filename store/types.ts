export interface Profile {
  id: string;
  nom: string | null;
  quartier: string | null;
  commune: string | null;
  telephone: string | null;
  role: 'resident' | 'enqueteur' | 'admin';
  created_at: string;
}

export interface SosSignal {
  id: string;
  user_id: string | null;
  type: 'inondation' | 'glissement' | 'route_coupee' | 'autre';
  priorite: 'faible' | 'moyenne' | 'haute' | 'critique';
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  signe_precurseur: string | null;
  niveau_eau_estime: number | null;
  quartier: string | null;
  created_at: string;
}

export interface CommunityKnowledge {
  id: string;
  user_id: string | null;
  titre: string;
  description: string | null;
  contenu: string | null;
  quartier: string | null;
  type: 'savoir' | 'observation' | 'pratique' | 'risque';
  categorie: string | null;
  source_type: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_lat: number | null;
  geo_lon: number | null;
  photo_url: string | null;
  valide: boolean;
  validated: boolean;
  created_at: string;
  pays: string | null;
  region: string | null;
  commune: string | null;
  porteur: string | null;
  confiance: number | null;
}

export interface FloodEvent {
  id: string;
  event_date: string;
  commune: string | null;
  quartier: string | null;
  latitude: number | null;
  longitude: number | null;
  precipitation_mm: number | null;
  precip_3d_mm: number | null;
  precip_7d_mm: number | null;
  precip_14d_mm: number | null;
  soil_saturation_index: number | null;
  flood_severity: number | null;
  label_source: string | null;
  data_source: string | null;
  created_at: string;
}

export interface FieldInterview {
  id: string;
  enqueteur_id: string | null;
  nom_interviewe: string | null;
  quartier: string | null;
  age: number | null;
  duree_residence: number | null;
  historique_inondations: Record<string, unknown>[];
  signes_precurseurs: Record<string, unknown>[];
  zones_risque: Record<string, unknown>[];
  pratiques_adaptation: Record<string, unknown>[];
  ressources_reseaux: Record<string, unknown>[];
  recommandations: string | null;
  created_at: string;
}

export interface Conseil {
  id: string;
  titre: string;
  contenu: string;
  type: 'prevention' | 'evacuation' | 'apres_inondation' | 'sante' | 'infrastructure';
  quartier: string | null;
  ordre: number;
}

export interface Sensor {
  id: string;
  nom: string;
  quartier: string | null;
  latitude: number | null;
  longitude: number | null;
  niveau_eau: number;
  statut: 'actif' | 'inactif' | 'alerte';
  derniere_lecture: string;
}

export interface QuartierSynthesis {
  quartier: string;
  nb_signalements: number;
  niveau_eau_moyen: number;
  derniere_alerte: string | null;
  nb_savoirs: number;
}

export interface QuartierSynthesisV2 {
  commune: string;
  evenements_inondation_documentes: number;
  derniere_inondation_labellisee: string | null;
  precip_7j_moyenne_jours_crues: number | null;
  flood_days_count: number | null;
  last_flood_date: string | null;
}

export interface ChatSource {
  id: string;
  titre: string;
  porteur: string | null;
  categorie: string | null;
  source_type: string | null;
  quartier: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  disclaimer?: string;
  model?: string;
  timestamp: string;
  generatedBy?: 'ai' | 'local';
}

export interface AlerteIA {
  id: string;
  commune: string;
  niveau: 'vigilance' | 'alerte' | 'urgence';
  message: string;
  flood_severity: number | null;
  nb_sos_critiques: number;
  lu: boolean;
  created_at: string;
}

export interface AgentAlerteResponse {
  success: boolean;
  alertes_generees: number;
  alertes: {
    commune: string;
    niveau: 'vigilance' | 'alerte' | 'urgence';
    message: string;
    flood_severity: number;
    nb_sos: number;
    timestamp: string;
  }[];
  contexte: {
    flood_events_analyses: number;
    sos_recents: number;
    communes_meteo: number;
  };
  error?: string;
}

export interface CarteMarker {
  marker_id: string;
  marker_type: 'savoir' | 'signalement';
  categorie: string | null;
  label: string | null;
  detail: string | null;
  quartier: string | null;
  commune: string | null;
  pays: string | null;
  latitude: number;
  longitude: number;
  source_type: string | null;
  porteur: string | null;
  confiance: number | null;
  statut: string | null;
  priorite: string | null;
  signal_timestamp: string | null;
}

export interface Preferences {
  selectedQuartier?: string;
}
