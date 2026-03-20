# Contrat API — cotisations, `/tontines/me`, `/users/me/next-payment`

> Ce dépôt est **mobile-only**. Implémenter côté **backend** les champs ci-dessous pour éviter toute ambiguïté métier (le mobile ne doit pas inférer « à jour » sans signal explicite).

## `GET /api/v1/tontines/me` (éléments « mes tontines »)

Pour chaque ligne vue par le membre connecté, exposer de préférence :

| Champ | Type | Description |
|-------|------|-------------|
| `hasPaymentDue` | `boolean` | **`true`** si une cotisation est attendue pour le cycle courant ; **`false`** si le membre est à jour. **Ne pas omettre** si l’état est connu côté serveur. |
| `nextPaymentDate` | `string` (YYYY-MM-DD) ou `null` | Prochaine échéance de cotisation pour ce membre dans cette tontine. |
| `paymentStatus` | `string` (optionnel) | Ex. statut paiement cycle courant (`PENDING`, `COMPLETED`, …). |
| `daysOverdue` | `number` (optionnel) | Jours de retard si applicable. |
| `penaltyAmount` | `number` (FCFA, optionnel) | Pénalité applicable sur le cycle courant. |
| `totalAmountDue` | `number` (FCFA, optionnel) | Total dû (base + pénalités) si connu. |
| `userSharesCount` | `number` (optionnel) | Parts du membre (montant base ≈ `amountPerShare * userSharesCount`). |

### Règles métier (tontine `ACTIVE`)

- Membre n’a pas payé, date d’échéance passée → retard + `hasPaymentDue: true`, renseigner `daysOverdue` / `penaltyAmount` si applicable.
- Membre n’a pas payé, échéance aujourd’hui ou future → `hasPaymentDue: true` (ou logique équivalente), dates cohérentes.
- Membre a payé pour le cycle courant → `hasPaymentDue: false`.
- Ne pas renvoyer `hasPaymentDue: false` implicite par absence de champ : le client traite l’absence comme **inconnu** (pas « à jour »).

## `GET /api/v1/users/me/next-payment`

Après **activation / initialisation des cycles** :

- Ne pas répondre **`204 No Content`** si au moins une cotisation est en attente pour le membre.
- Répondre **`200`** avec le corps attendu par le mobile (`NextPaymentData` : `tontineUid`, `tontineName`, `cycleUid`, `amountDue`, `penaltyAmount`, `totalDue`, `dueDate`, `paymentStatus`, …).

### Priorité si plusieurs tontines sont dues

1. Retard le plus ancien (le plus de jours en retard).
2. Sinon échéance la plus proche (y compris aujourd’hui).

## `GET /api/v1/tontines/:uid` / `GET /api/v1/cycles/current/:tontineUid`

Enrichir si nécessaire pour que le détail tontine et le cycle courant reflètent le même état de paiement que `/tontines/me` (cohérence des écrans après démarrage).

## Tests backend (à implémenter sur le service API)

1. Tontine démarrée + cycles initialisés + membre non payé → `next-payment` renvoie une échéance (200).
2. Membre en retard → `/tontines/me` indique retard / `hasPaymentDue` cohérent.
3. Membre à jour → pas de `hasPaymentDue: true` sans raison.
4. Pénalité applicable → montants corrects sur liste et `next-payment` si concerné.
