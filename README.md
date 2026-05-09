# Tournoi d’échecs (local + suivi web)

## Déroulé technique (récap)

| Élément | Statut |
|--------|--------|
| **Domaine** `types.ts` + `pairing.ts` — R1 par ELO (high-low), rondes suivantes par score puis ELO, anti-rematch (heuristique + swaps), bye si impair | Implémenté |
| **Arborescence** `data/tournaments/{id}/` : `config.json`, `events.ndjson`, `snapshots/` + `state.json` (lecture rapide) | Implémenté |
| **Journal** : chaque ligne NDJSON a `prevLineHash`, `stateHash` (SHA-256 du `state.json`), `lineHash` (chaîne sur le lot précédent + enregistrement) | Implémenté |
| **Réhydratation** : si `state.json` absent, le GET `/api/tournament/:id/state` charge le dernier `snapshots/state-{16}.json` référencé par un `stateHash` dans le journal | Implémenté |
| **TournamentProvider** (`useState`) + `localStorage` miroir + API locale dev (`serverInit`, `serverPersist`, optionnel `serverSave` POST) | Implémenté |
| **Middleware Vite** : `PUT …/persist` ou `POST …/save` ; `ENABLE_TOURNAMENT_GIT_SYNC=1` → `git add` / commit / push sur `data/` **uniquement** quand l’événement est `RESULT_SET` (saisie d’un résultat de partie), pas à la validation de ronde | Implémenté |
| **Site spectateur (Pages forge)** : build `spectateur`, `VITE_PUBLIC_STATE_URL` + polling, pas d’écriture | Voir ci-dessous |
| **UI** + pages Setup / Rounds / Leaderboard + router | Implémenté |

## Développement (organisateur)

```bash
npm install
npm run dev
```

### Fichiers par tournoi (`data/tournaments/<id>/`)

- **`config.json`** — meta / roster figé au démarrage (ex-roster exporté côté client).
- **`state.json`** — état courant complet (même contenu que la dernière ligne utile côté snapshots).
- **`events.ndjson`** — append-only : `TOURNAMENT_STARTED`, `RESULT_SET`, `ROUND_VALIDATED`, etc., avec chaîne de hashes.
- **`snapshots/`** — `roster-*.json` (inscription), `state-*.json` (copie d’état après chaque persistance, suffixe = 16 premiers caractères du hash d’état).

Fichier public **`data/public/live.json`** : dernier état servi aux spectateurs (Pages).

**Import** : depuis la liste ou l’écran d’inscription, un fichier **JSON d’état** (`TournamentState`) ou une **archive v1** (`exportFormat: "chess-tournament-archive-v1"` avec un objet `state` valide) est accepté ; seul `state` est chargé en mémoire (le journal / snapshots de l’archive ne sont pas rejoués vers le disque).

### API locale (uniquement `npm run dev`)

- `POST /api/tournament/init` — crée le dossier tournoi.
- `PUT /api/tournament/:id/persist` ou **`POST /api/tournament/:id/save`** — même corps JSON `{ state, event?, triggerGit? }`.
- `GET /api/tournament/:id/archive` — export unique (config, state, `events.ndjson`, fichiers `snapshots/`).
- `DELETE /api/tournament/:id` — supprime le dossier du tournoi ; si c’était le tournoi publié dans `live.json`, le fichier public est vidé (timestamp seul).

- Écriture des fichiers via le middleware Vite.
- Optionnel : commits / push automatiques **après chaque saisie de résultat** (`RESULT_SET` + `triggerGit: true`) :

```bash
ENABLE_TOURNAMENT_GIT_SYNC=1 npm run dev
```

## Build production

### Organisateur (sans URL publique)

```bash
npm run build
npm run preview
```

---

## Déployer le site spectateur (hébergement Pages)

Objectif : publier une **version spectateur** du site (lecture seule) qui affiche rondes et classement en lisant un JSON public — typiquement `data/public/live.json` du même dépôt, servi via **l’URL « raw » / fichier brut** de ta forge.

### Ce que tu obtiens

- Une URL publique de type **`<origine-Pages>/<préfixe-dépôt>/`** (le détail dépend de la forge ; souvent le nom du dépôt apparaît dans le chemin).
- Mise à jour des **scores** : en général il suffit de **pousser** un nouveau `live.json` sur la branche utilisée dans l’URL du JSON ; **pas besoin** de redéployer le site statique à chaque partie (sous réserve du cache CDN, voir plus bas).

### 1. Activer le fournisseur « Pages » + CI

Dans les paramètres du dépôt sur ta forge : activer **Pages** (site statique), avec **construction via CI** suivant le fichier [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (emplacement conventionnel pour les workflows du fournisseur le plus répandu).

### 2. Définir l’URL du JSON public (`VITE_PUBLIC_STATE_URL`)

Le build spectateur **embarque** cette URL dans le JS ; elle doit pointer vers le fichier d’état **brut** (JSON accessible en GET public).

Dans les **variables CI** du dépôt :

1. Nom : **`VITE_PUBLIC_STATE_URL`**
2. Valeur : URL complète vers `live.json` après mise en ligne du dépôt ; forme commune sur les forges courantes : **`https://<hôte>/<propriétaire>/<dépôt>/raw/<branche>/data/public/live.json`** (adapté à ton arborescence exacte).

   Ce fichier doit **exister** sur la **branche** indiquée (ex. `main`) après tes pushes (généré en local avec `npm run dev` + tournoi, ou copié par ton automatisation).

> Le workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) injecte cette valeur via **`vars.VITE_PUBLIC_STATE_URL`**. Si elle est absente, le build peut réussir mais le site spectateur n’aura **aucune** URL de données.

### 3. Base path (`VITE_BASE_PATH`)

Si le site est servi sous un **sous-chemin** `/nom-du-repo/`, les assets Vite doivent utiliser ce préfixe.

Le workflow le fixe pour le CI courant ainsi :

`VITE_BASE_PATH` est aligné automatiquement sur le **nom du dépôt** dans le fichier de workflow CI (voir `pages.yml`). Tu n’as **rien** à dupliquer à la main côté variables pour ce point si tu gardes cette configuration.

### 4. Déclencher le déploiement

- Le workflow **Deploy … Pages** se lance sur chaque **push** sur la branche **`main`** (voir `on:` dans `pages.yml`).
- Vérifie dans l’onglet **CI** que le job **build** puis **deploy** réussissent ; l’URL du site s’affiche dans les paramètres Pages une fois le premier déploiement réussi.

### 5. Tester le build spectateur en local

Fichier d’exemple : [`.env.spectateur.example`](.env.spectateur.example).

```bash
cp .env.spectateur.example .env.spectateur
# Éditer VITE_PUBLIC_STATE_URL et VITE_BASE_PATH=/ton-repo/
npm run build:spectateur
npm run preview
```

Ouvre l’URL indiquée par Vite ; pour un site sous préfixe, utilise le chemin complet (ex. `http://localhost:4173/ton-repo/`).

### 6. Mettre à jour les données visibles par les spectateurs

1. Depuis la machine du club : `npm run dev`, enregistrement des résultats → `data/public/live.json` mis à jour.
2. **Commit + push** de `data/public/live.json` (et du reste si besoin) sur la branche référencée dans **`VITE_PUBLIC_STATE_URL`**.
3. Les spectateurs reçoivent les changements au prochain **polling** (défaut **15 s** ; variable optionnelle `VITE_PUBLIC_POLL_INTERVAL_MS` dans le workflow ou en local).

**Cache** : l’hôte qui sert le fichier **raw** peut mettre quelques minutes à exposer la dernière version ; ce n’est pas lié au redéploiement du site Pages.

### 7. Mode spectateur (rappel)

Avec `VITE_PUBLIC_STATE_URL` définie au build : pas d’API locale, pas d’écriture, pas de gestion organisateur dans le navigateur — uniquement lecture du JSON et navigation **Rondes** / **Classement**.

### Dépannage rapide

| Problème | Piste |
|----------|--------|
| Page blanche ou assets 404 | Vérifier que **`VITE_BASE_PATH`** correspond au préfixe du site (`/mon-repo/`). |
| « Chargement… » sans fin | **`VITE_PUBLIC_STATE_URL`** absente au build, JSON inaccessible (404), ou JSON sans `tournamentId` / `players` valides. |
| Données qui ne bougent pas | Cache côté hôte raw ; vérifier que le push touche bien la **branche** utilisée dans l’URL du JSON. |
| Workflow rouge | Journaux **CI** ; `npm ci` / `npm run build:spectateur` en local avec les mêmes variables. |

### Push Git manuel des données

Si tu n’utilises pas `ENABLE_TOURNAMENT_GIT_SYNC=1` pendant le dev :

```bash
npm run tournament:push
```

(`git add` sur `data/tournaments/` et `data/public/live.json`, commit si nécessaire, puis `git push`.)

## Routes

- **`/tournaments`** — section « Tournois » avec sous-navigation :
  - **`/tournaments`** (index) — liste, nouveau, import (organisateur).
  - **`/tournaments/rounds`** — rondes et résultats.
  - **`/tournaments/leaderboard`** — classement et export TSV / JSON.
- Redirections : `/tournament` → rounds, `/leaderboard` → leaderboard ; anciennes URLs françaises (`/tournaments/rondes`, `/tournaments/tournoi`, `/tournaments/classement`) redirigent aussi.
- `/setup` — inscription (uniquement sans tournoi chargé ; sinon redirection vers `/tournaments`).
