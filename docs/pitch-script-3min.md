# Script pitch Alert'I — 3 minutes

**Durée cible :** 2 min 50 – 3 min 00  
**Rythme :** ~140 mots/min → ~420 mots au total  
**Support :** web desktop (fenêtre ≥ 1024 px) + slide architecture en ouverture

---

## Avant de commencer (30 s hors chronomètre)

- [ ] Onglet web ouvert sur la carte Bamako (`/map`)
- [ ] Compte connecté (résident ou admin)
- [ ] Slide architecture ouverte en second écran ou en onglet 1
- [ ] Chronomètre prêt (téléphone en mode silencieux)
- [ ] Question Aminata copiée dans le presse-papier : *« Quels sont les signes avant-coureurs d'une crue au quartier ? »*

---

## 0:00 – 0:25 | Accroche & problème (~60 mots)

> Bonjour. Je m'appelle [Prénom], et je vous présente **Alert'I**.
>
> À Bamako, chaque saison des pluies, le fleuve Niger monte. Les anciens du quartier savent lire les signes : l'odeur de la terre, le bruit de l'eau, les criquets qui se taisent. Mais ces savoirs restent **dans la tête des gens** — dispersés, oraux, invisibles pour la DNE et la protection civile.
>
> Notre défi IA Challenge : **comment collecter, structurer et exploiter intelligemment ces connaissances locales africaines ?**

**[Action]** Regarder le jury. Pas d'écran encore.

---

## 0:25 – 0:55 | Solution & architecture 4 agents (~70 mots)

> Alert'I est un **système multi-agents** qui transforme le savoir communautaire en intelligence actionnable.
>
> Quatre agents autonomes :
> 1. **Collecte** — citoyens, enquêteurs terrain, signalements SOS géolocalisés ;
> 2. **Structuration** — validation institutionnelle, cartographie, index de confiance ;
> 3. **Orientation** — Aminata, notre experte IA, répond en s'appuyant **uniquement** sur des fiches validées ;
> 4. **Alerte** — analyse les signaux et notifie les institutions et les résidents.
>
> Ce n'est pas une boîte noire : **chaque réponse cite ses sources communautaires.**

**[Action]** Montrer la slide architecture 4 agents (5 s), puis basculer sur l'app web.

---

## 0:55 – 2:10 | Démo live (~30 mots parlés + actions écran)

### Étape 1 — Carte (0:55 – 1:15)

> Voici la carte opérationnelle de Bamako.

**[Action]** Onglet **Carte** — zoomer sur 2–3 marqueurs (savoir communautaire + SOS).

> Chaque point représente un savoir local validé ou un signalement en temps réel.

---

### Étape 2 — Savoir (1:15 – 1:30)

**[Action]** Onglet **Savoir communautaire** — montrer une fiche existante ou l'onglet Partager.

> Les résidents et enquêteurs capturent les connaissances : signes précurseurs, zones à risque, pratiques d'évacuation.

---

### Étape 3 — Aminata (1:30 – 1:55) ⭐ moment clé

**[Action]** Onglet **Orientation IA** — coller la question :

> *« Quels sont les signes avant-coureurs d'une crue au quartier ? »*

> Aminata interroge notre base de savoirs validés, puis Gemini formule une réponse ancrée sur le terrain.

**[Action]** Attendre la réponse. **Montrer les sources citées** sous le message.

> Vous voyez ici les fiches communautaires utilisées — pas d'invention, pas de hallucination.

---

### Étape 4 — Supervision (1:55 – 2:10)

**[Action]** Menu latéral → **Supervision** (`/gov-dashboard`) — onglet Savoir ou vue d'ensemble KPIs.

> Côté institution, la DNE modère les fiches, suit les signalements, et consulte les logs des agents IA.

---

## 2:10 – 2:40 | IA, innovation & différenciation (~90 mots)

> Techniquement : **Gemini 2.0 Flash** couplé à un retrieval hybride — recherche par mots-clés, scoring par quartier et niveau de confiance.
>
> Ce qui nous différencie :
> - le savoir **communautaire validé**, pas seulement la météo satellite ;
> - la **géo-contextualisation** — Aminata priorise votre quartier ;
> - la **gouvernance** — rien n'est publié sans validation institutionnelle ;
> - une **boucle fermée** : collecte terrain → IA → alerte → retour citoyen.
>
> Stack **Expo + Supabase** : une seule codebase, web pour les institutions, mobile pour le terrain.

**[Action]** Revenir brièvement sur la sidebar desktop (ergonomie web).

---

## 2:40 – 3:00 | Impact & clôture (~70 mots)

> L'impact est concret : des réponses instantanées là où les appels à la protection civile restent sans réponse ; des quartiers à risque documentés par ceux qui y vivent ; des savoirs oraux des anciens **préservés et structurés** pour les générations futures.
>
> Alert'I est déployable au Mali aujourd'hui, réplicable à Ouagadougou, Niamey, ou tout contexte où le savoir local doit devenir intelligence collective.
>
> **Alert'I — l'intelligence collective des savoirs locaux face aux inondations.** Merci.

**[Action]** Sourire, pause 2 s, ouvrir aux questions.

---

## Timing récapitulatif

| Segment | Durée | Mots (~) |
|---------|-------|----------|
| Accroche & problème | 0:25 | 60 |
| Solution 4 agents | 0:30 | 70 |
| Démo carte + savoir | 0:35 | 20 |
| Démo Aminata | 0:25 | 10 |
| Démo supervision | 0:15 | 0 |
| IA & innovation | 0:30 | 90 |
| Impact & clôture | 0:20 | 70 |
| **Total** | **~3:00** | **~320 parlés + démo** |

---

## Plan B (réseau coupé)

1. Montrer la **capture vidéo** backup (60 s) pendant que vous parlez de l'architecture.
2. Phrase de secours : *« Aminata fonctionne en mode retrieval local même sans connexion Gemini — les sources restent citées. »*
3. Gov-dashboard affiche des données mock crédibles si Supabase est lent.

---

## Réponses aux questions fréquentes du jury

**« Pourquoi pas juste un chatbot ? »**  
→ Parce qu'Aminata ne répond qu'à partir de fiches **validées par la communauté et les institutions**, avec citation des sources.

**« Comment gérez-vous la faible connectivité ? »**  
→ Timeouts à 15 s, fallback retrieval sans Gemini, app mobile terrain pour la collecte hors-ligne (roadmap).

**« C'est reproductible hors inondations ? »**  
→ Oui — même architecture agents pour agriculture, santé, gestion de l'eau. Bamako inondations = pilote SMART.

**« Quel modèle IA ? »**  
→ Gemini 2.0 Flash via Supabase Edge Functions, RAG sur PostgreSQL.

---

## Checklist jour J (15h)

- [ ] Script imprimé ou sur second écran
- [ ] Slide architecture ouverte
- [ ] URL web stable (pas localhost)
- [ ] Question Aminata testée ce matin
- [ ] Chronomètre validé une fois en répétition complète
