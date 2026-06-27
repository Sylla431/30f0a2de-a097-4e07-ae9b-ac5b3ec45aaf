# Alert'I

**Système IA autonome de gestion intelligente des connaissances locales**

> Cas pilote : résilience face aux inondations à Bamako, Mali — Fleuve Niger, Sahel.

Projet soumis au **IA Challenge** — thème : *collecter, structurer et exploiter des connaissances communautaires ou institutionnelles africaines*.

---

## Problème

À Bamako, les communautés riveraines du Niger possèdent des savoirs oraux et pratiques sur les crues (signes précurseurs, zones à risque, pratiques d'évacuation). Ces connaissances restent dispersées, non structurées et peu accessibles aux institutions (DNE, protection civile).

## Solution

**Alert'I** transforme le savoir local en intelligence actionnable grâce à une architecture **multi-agents** : collecte terrain → structuration institutionnelle → orientation citoyenne par IA → alerte précoce.

Chaque réponse de l'assistant **Aminata** s'appuie sur des fiches communautaires **validées** et cite ses sources.

---

## Architecture — 4 agents

| Agent | Rôle | Implémentation |
|-------|------|----------------|
| **Collecte** | Formulaires citoyens, entretiens terrain (7 étapes), signalements SOS géolocalisés | `app/(tabs)/knowledge`, `app/(tabs)/sos` |
| **Structuration** | Modération institutionnelle, scoring de confiance, cartographie OSM | `app/gov-dashboard` |
| **Orientation (Aminata)** | RAG + Gemini 2.0 Flash, réponses ancrées avec citations | `supabase/functions/agent-orientation` |
| **Alerte** | Analyse des signaux, génération d'alertes IA (`alertes_ia`) | Tableau de supervision + inbox profil |

Schéma détaillé : ouvrir [`docs/slide-architecture-agents.html`](docs/slide-architecture-agents.html) dans un navigateur.

---

## Fonctionnalités

### Citoyens (mobile & web)
- **Carte** — visualisation des savoirs communautaires, SOS et événements d'inondation
- **Savoir** — contribution et consultation de connaissances locales
- **Entretiens** — capture structurée par enquêteurs terrain
- **Orientation IA** — chat avec Aminata (RAG sur fiches validées)
- **SOS** — signalements d'urgence en temps réel
- **Vérification de zone** — évaluation du risque selon la position GPS

### Institutions (web desktop)
- **Tableau de supervision** — KPIs, gestion SOS, capteurs, modération des fiches
- **Shell admin** — navigation latérale responsive (desktop ≥ 1024 px)
- **Alertes IA** — notifications générées par l'agent d'alerte

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Expo 54, React Native, React 19, TypeScript, Expo Router |
| État | Zustand + AsyncStorage |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Edge Functions) |
| IA | Google Gemini 2.0 Flash + retrieval hybride (mots-clés, scoring quartier/confiance) |
| Cartes | OpenStreetMap |
| Déploiement web | Vercel (export statique Expo) |

---

## Prérequis

- Node.js 18+
- Compte [Supabase](https://supabase.com) avec le schéma du projet
- Clé API Gemini (secret Supabase : `GEMINI_API_KEY` sur la Edge Function `agent-orientation`)

---

## Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd alert-i

# Installer les dépendances
npm install
# ou : bun install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés Supabase
```

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase |

Sur Supabase (Edge Functions), configurer également :
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (pour l'agent Aminata)

---

## Lancer en local

```bash
# Développement (mobile + web)
npx expo start

# Web uniquement
npx expo start --web

# Tests
npm test

# Lint
npm run lint
```

Ouvrir `http://localhost:8081` pour la version web. Pour l'interface admin desktop, utiliser une fenêtre ≥ 1024 px de large.

---

## Build & déploiement web

```bash
npm run build:web
```

Le dossier `dist/` est généré pour un déploiement statique. Configuration Vercel incluse (`vercel.json`).

Sur Vercel, ajouter les variables `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans les paramètres du projet.

---

## Structure du projet

```
app/                    # Écrans Expo Router
  (tabs)/               # Onglets citoyens (carte, sos, savoir, orientation, profil)
  gov-dashboard.tsx     # Tableau de bord institutionnel
  risk-check.tsx          # Vérification de zone
components/             # UI (carte OSM, admin shell, chat, alertes)
constants/              # Brand, quartiers Bamako, navigation admin
hooks/                  # Layout responsive, realtime
lib/                    # Client Supabase, utilitaires
store/                  # État global Zustand
supabase/functions/     # Edge Functions (agents IA)
docs/                   # Script pitch 3 min, slide architecture
```

---

## Documentation pitch (IA Challenge)

- [Script pitch 3 minutes](docs/pitch-script-3min.md)
- [Slide architecture 4 agents](docs/slide-architecture-agents.html)

---

## Alignement avec les critères du challenge

| Critère | Réponse dans Alert'I |
|---------|----------------------|
| Version Web | Interface admin desktop, gov-dashboard, carte responsive |
| Version Mobile | Même codebase Expo (iOS, Android, web) |
| Solution proposée | Gestion intelligente des savoirs locaux africains (pilote inondations Bamako) |
| Utilisation de l'IA | Gemini + RAG communautaire avec citations de sources |
| Innovation | Boucle fermée collecte → validation → IA → alerte, gouvernance institutionnelle |
| Faisabilité | Prototype déployable (Expo + Supabase) |
| Impact | Résilience communautaire, préservation des savoirs oraux, aide aux institutions |

---

## Licence

Projet académique — IA Challenge. Tous droits réservés aux auteurs.
