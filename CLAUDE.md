# CLAUDE.md — Kelemba Digital · Référence permanente Claude / Cursor

> **À lire intégralement au démarrage de chaque session avant tout prompt.**
> Ce fichier est le contrat de contexte du monorepo Kelemba. Il prime sur tout autre fichier.

---

## 0. RÈGLE ABSOLUE — COMPATIBILITÉ EXPO SDK 54

> ⚠️ **CRITIQUE — NE JAMAIS IGNORER CETTE SECTION.**

Le projet est verrouillé sur **Expo SDK 54**. Toute dépendance installée doit être
**strictement compatible** avec ce SDK. Le non-respect de cette règle provoque des erreurs
runtime critiques sur iOS (Hermes) du type `TypeError: property is not configurable`
ou `[runtime not ready]`, qui sont **impossibles à déboguer sans reverter**.

### Règle d'installation obligatoire

```bash
# TOUJOURS utiliser expo install — JAMAIS npm install / yarn add pour les packages RN
npx expo install <package>
```

`npx expo install` résout automatiquement la version compatible avec le SDK 54.
`npm install` ou `yarn add` peuvent installer une version incompatible sans avertissement.

---

### ❌ Packages INTERDITS pour Expo SDK 54

| Package | Raison |
|---------|--------|
| `react-native-reanimated` **< 4.x** | Incompatible SDK 54 — utiliser ~4.1.0 |
| `react-native-reanimated` **>= 5.x** | Non testé SDK 54 |
| Tout package avec `peerDependency` `react-native >= 0.82` | Incompatible RN 0.81.5 |
react-native-reanimated ~4.1.x✅ REQUIS
react-native-worklets ~0.4.0✅ REQUIS (peer dep)
react-native-reanimated ~3.x❌ Incompatible SDK 54
react-native-reanimated/plugin dans babel❌ Interdit (doublon)
react-native-reanimated dans app.json plugins❌ Interdit (n'existe plus en v4)

### ✅ Versions verrouillées compatibles SDK 54

| Package | Version exacte |
|---------|---------------|
| `react-native` | `0.81.5` |
| `react` | `19.1.0` |
| `react-native-reanimated` | `~4.1.1` |
| `react-native-worklets` | `~0.5.1` |
| `react-native-gesture-handler` | `~2.28.0` |
| `react-native-safe-area-context` | `~5.6.0` |
| `react-native-screens` | `~4.16.0` |
| `react-native-svg` | `15.12.1` |

---

### Configuration `babel.config.js` obligatoire

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': './src' },
        },
      ],
      // ✅ NE PAS ajouter 'react-native-reanimated/plugin' — géré par babel-preset-expo
    ],
  };
};
```

> ⚠️ Reanimated 4.x + Expo SDK 54 : le plugin Babel est injecté automatiquement.
> L'ajouter manuellement provoque l'erreur `[runtime not ready]` sur iOS Hermes.

---
### Chargement et affichage des Données

Toutes les données doivent provenir de la base de données, pas de données fake.

---

### Configuration `app.json` obligatoire

```json
{
  "expo": {
    "plugins": [
      "react-native-reanimated"
    ]
  }
}
```

---

### Configuration `index.js` obligatoire

```js
import 'react-native-gesture-handler'; // ← DOIT ÊTRE LA TOUTE PREMIÈRE LIGNE
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

---

### Vérification de compatibilité avant chaque install

```bash
npx expo install --check
```

Cette commande liste les packages qui ne correspondent pas aux versions attendues par SDK 54.
**Corriger toutes les divergences avant de continuer.**

---

### Séquence de reset après tout problème de dépendances (Windows PowerShell)

```powershell
# 1. Supprime node_modules et le lock
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# 2. Vide le cache npm
npm cache clean --force

# 3. Réinstalle proprement
npm install

# 4. Réinstalle Reanimated 4 via expo install (résolution SDK 54 auto)
npx expo install react-native-reanimated@~4.1.0
npx expo install react-native-worklets@~0.5.0

# 5. Vérifie les compatibilités
npx expo install --check

# 6. Relance Metro sans cache
npx expo start --reset-cache --clear
```

---

## 1. PROJET

Kelemba est une application mobile de gestion de tontines numériques destinée à la
République Centrafricaine (RCA), pays à faible bancarisation (< 15 %) où la tontine est
le principal mécanisme d'épargne communautaire. La monnaie est le **FCFA (XAF)**.
La base utilisatrice est à **70 % féminine**, sur appareils **Android/iOS milieu de gamme**,
dans des conditions réseau **2G/3G**. Stack : **React Native Expo SDK 54** (mobile) +
**NestJS** (backend API) + **Next.js 14** (admin web).
Paiements : **Orange Money** et **Telecel Money** via webhooks.

---

## 2. ARCHITECTURE

```
kelemba/
├── kelemba-mobile/      # React Native · Expo SDK 54 · TypeScript strict
│                        # React Navigation v6 · Redux Toolkit · React Query · Axios
│                        # Expo SecureStore · PIN + biométrie · offline-first
│
├── backend/             # NestJS · PostgreSQL · Prisma ORM · Redis (cache + BullMQ)
│                        # API REST JSON · Guards JWT RS256 · Class-validator DTOs
│                        # Kong Gateway / Nginx WAF en amont
│
└── admin/               # Next.js 14 App Router · TypeScript · RBAC · Audit logs
                         # Tableau de bord consolidé associations multi-tontines
```

### Contrats inter-couches
- **API REST JSON** uniquement — pas de GraphQL, pas de tRPC.
- **Auth JWT RS256** : access token 15 min | refresh token 30 jours (rotation silencieuse).
- **Paiements** : webhooks Orange Money et Telecel Money signés **HMAC-SHA256**.
- **Base de données** : PostgreSQL + Redis (sessions, rate-limiting, file BullMQ).
- Ordre de build : **Backend → Mobile → Admin**.

---

## 3. RÈGLES DE CODE (NON NÉGOCIABLES)

### TypeScript
- **`strict: true`** dans tous les `tsconfig.json`.
- Pas de `any` explicite. Utiliser `unknown` + type guard.
- Exporter les types partagés depuis `libs/types/`.

### Logs & Observabilité
- **Zéro `console.log` en production.** Backend : `winston` + `Logger` NestJS.
- Mobile : wrapper logger (`src/utils/logger.ts`) désactivable via config.

### Gestion d'erreurs
- **Aucun `catch` vide.** Logger l'erreur + relancer ou retourner une erreur métier.
- Backend : exceptions héritent de `HttpException` avec `{ code, message, details? }`.
- Mobile : feedback utilisateur lisible pour chaque erreur réseau ou métier.

### Paiements — Idempotence obligatoire
- Header **`idempotency-key`** (UUID v4) sur tous les endpoints paiement.
- Redis stocke clé + résultat (TTL 24h).
- Transactions financières dans **`prisma.$transaction`**.

### Identifiants
- **Jamais d'ID séquentiel exposé.** UUID v4 (`crypto.randomUUID()`) partout.

### Validation
- **Backend** : `class-validator` + `class-transformer` sur tous les endpoints.
- **Mobile** : **Zod** + `react-hook-form`.

### Règle de préservation des fichiers existants

Quand Cursor modifie un fichier existant, il doit TOUJOURS :
1. Lire le fichier complet avant de l'éditer (str_replace, pas réécriture)
2. Ne modifier QUE les sections concernées par le prompt
3. Jamais réécrire un fichier i18n — uniquement ajouter des clés
4. Vérifier que l'encodage UTF-8 est préservé sur les fichiers JSON
5. Ne jamais supprimer du code non lié au bug en cours de correction

---
## RÈGLE LAYOUT — ScrollView horizontal avec hauteur fixe
Ne jamais mettre `height` directement dans le `style` prop d'un ScrollView horizontal.
Yoga (React Native / iOS) ignore cette contrainte dans un flex column.

✅ CORRECT :
<View style={{ height: 52 }}>
  <ScrollView horizontal contentContainerStyle={...}>
    ...
  </ScrollView>
</View>

❌ INTERDIT :
<ScrollView horizontal style={{ height: 52 }} ...>

## 4. CONTRAINTES MÉTIER CLÉS

### Score Kelemba (0–1000)
- Calculé par `ScoringService.recalculate(userId)` — jamais manuellement dans un controller.
- Score à **0** → bannissement automatique (`BANNED`).

### Rotation de tontine
- Modifiable **une seule fois** après démarrage, par le créateur uniquement.
- Log audit + notification push membres sous 30 secondes.

### Atomicité des paiements
- Toute opération financière dans **`prisma.$transaction`**.
- Statuts : `PENDING` → `PROCESSING` → `COMPLETED` | `FAILED` | `REFUNDED`.

### KYC — Condition préalable absolue
- Statut KYC `VERIFIED` requis pour rejoindre ou créer une tontine.
- Guard NestJS `@KycVerifiedGuard()` sur tous les endpoints tontine et paiement.

### Protection du bénéficiaire
- Le bénéficiaire du tour en cours **n'est jamais pénalisé** pour les retards des autres.
- Retard de versement → événement `POT_DELAYED` + notification avec date révisée.

### Montants
- Minimum : **500 FCFA** par part.
- Maximum : **50 membres** par tontine simple.
- Montants en **entiers FCFA** — pas de centimes (`Int` ou `BigInt` en base).

### Offline-first (mobile)
- Cache local via **Expo SQLite** ou **MMKV**.
- Synchronisation dès reconnexion, résolution de conflits par `updatedAt`.

---

## 5. SÉCURITÉ

### Backend — OWASP API Security Top 10

| Risque | Mesure |
|--------|--------|
| API1 — Broken Object Level Auth | Vérifier `resource.ownerId === req.user.id` dans le service |
| API2 — Broken Auth | JWT RS256, rotation refresh token, révocation Redis |
| API3 — Broken Object Property Level Auth | DTOs `whitelist: true` + `forbidNonWhitelisted: true` |
| API4 — Unrestricted Resource Consumption | Rate limiting Redis (`@nestjs/throttler`) |
| API5 — Broken Function Level Auth | Guards RBAC `@Roles()` sur chaque endpoint |
| API6 — SSRF | Whitelist URLs autorisées pour appels externes |
| API7 — Security Misconfiguration | Helmet, CORS strict, pas de stack traces en prod |
| API8 — Automated Threats | CAPTCHA register/login, rate limit IP + user |
| API9 — Improper Inventory | Routes versionnées `/api/v1/...` |
| API10 — Unsafe API Consumption | Valider toutes les réponses providers externes |

### Mobile — OWASP Mobile Top 10
- **Expo SecureStore** pour JWT, PIN, données KYC — jamais AsyncStorage.
- Certificate Pinning sur les appels API production.
- PIN 6 chiffres + biométrie. Aucun secret hardcodé.
- SQLite chiffré ou MMKV + clé Secure Enclave.

### Secrets
- **Aucun secret dans le code.** Variables `.env` (gitignorés) + secrets manager en prod.
- Fichiers `.env.example` commités sans valeurs réelles.

### Audit Trail
Toutes les actions financières, KYC, rotation, admin, auth → table `audit_logs`.

```ts
{ id, userId, action, entityType, entityId, metadata: JSON, ip, userAgent, createdAt }
```

---

## 6. SYSTÈME DE DESIGN

| Token | Valeur | Usage |
|-------|--------|-------|
| `color.primary` | `#1A6B3C` | Vert Kelemba |
| `color.secondary` | `#F5A623` | Orange Money — CTA |
| `color.accent` | `#0055A5` | Bleu Score Kelemba |
| `color.danger` | `#D0021B` | Rouge erreurs/retards |

- Splash Screen : fond `#1A5C38`, logo circulaire blanc centré, spinner `ActivityIndicator`.
- Boutons minimum **48dp** (WCAG AA).
- Bilinguisme **Français / Sango** via `i18n`.
- Tagline : *"Votre tontine numérique / Tontine na yângâ"*

---

## 7. MODULES MÉTIER

| Module | Couche | Statut |
|--------|--------|--------|
| Onboarding & Auth (OTP + PIN + biométrie) | Mobile + Backend | Core |
| KYC (CNI/Passeport + selfie) | Mobile + Backend | Core |
| Tontines (création, invitation QR/SMS/WhatsApp) | Mobile + Backend | Core |
| Rotation & Gestion des cycles | Backend | Core |
| Paiements Orange Money / Telecel Money | Backend (webhooks) | Core |
| Score Kelemba | Backend | Core |
| Notifications Push (Firebase FCM) | Mobile + Backend | Core |
| Rapports & Export PDF | Mobile + Admin | Étendu |
| Tchat de groupe par tontine | Mobile + Backend | Étendu |
| Association multi-tontines | Mobile + Backend + Admin | Étendu |
| Offline-first & Sync | Mobile | Critique 2G/3G |
| Internationalisation Sango | Mobile | Phase 2 |
| CI/CD + Monitoring production | Backend + Admin | Infra |

---

## 8. PROMPT-PRÉFIXE RECOMMANDÉ (nouvelle session)

> Copier-coller ce bloc **avant chaque premier prompt** d'une nouvelle session.

```
Contexte Kelemba — lis CLAUDE.md avant tout.

Tu travailles sur Kelemba, une fintech de gestion de tontines numériques en RCA.

Stack : React Native Expo SDK 54 (TypeScript strict) · NestJS + PostgreSQL + Prisma + Redis
· Next.js 14 Admin. Monnaie : FCFA (entiers). Réseau : 2G/3G, Android milieu de gamme.

🔒 CONTRAINTE CRITIQUE SDK 54 :
- react-native: 0.81.5 · react: 19.1.0
- react-native-reanimated: ~4.1.0 (JAMAIS 3.x ni 5.x)
- react-native-worklets: ~0.5.0 (peer dep obligatoire de Reanimated 4.1.x)
- Utiliser UNIQUEMENT npx expo install pour toutes les dépendances RN
- babel.config.js: NE PAS ajouter 'react-native-reanimated/plugin' — géré par babel-preset-expo
- app.json plugins[]: "react-native-reanimated" doit être déclaré
- index.js: import 'react-native-gesture-handler' DOIT être la ligne 1 absolue

Règles absolues :
- TypeScript strict (noImplicitAny, strictNullChecks)
- Zero console.log en prod (winston/NestJS Logger)
- Gestion d'erreurs exhaustive, catch jamais vide
- UUID v4 partout, jamais d'ID séquentiel exposé
- Validation DTO (class-validator) sur tous les endpoints
- Paiements idempotents + prisma.$transaction
- KYC vérifié obligatoire avant toute action tontine
- Score Kelemba 0-1000 via ScoringService uniquement
- OWASP API Security Top 10 + OWASP Mobile Top 10
- Audit trail sur toutes les actions financières et admin
- Aucun secret dans le code

Module en cours : [DÉCRIRE LE MODULE ICI]
Fichier(s) cible(s) : [INDIQUER LES CHEMINS]
```

---

*Dernière mise à jour : mars 2026 — NeXus Technology Inc. · Kelemba Digital v2 · Expo SDK 54 LOCKED*
*Correction critique : Reanimated 3.x → 4.1.0 + suppression babel plugin manuel*