# Migration: Remplacer xlsx par exceljs pour corriger les vulnérabilités de sécurité

## 🚨 Contexte de sécurité

**xlsx** (SheetJS) version 0.18.5 contient **2 vulnérabilités élevées** non corrigées :

| Vulnérabilité | CVE | Description |
|---|---|---|
| **Prototype Pollution** | GHSA-4r6h-8v6p-xvw6 | Permet la pollution de prototype via des objets Excel malveillants |
| **ReDoS** | GHSA-5pgg-2g8v-p4x9 | Déni de service via des expressions régulières dans le parsing |

**Problème** : SheetJS a migré vers un modèle commercial. Aucune version publique ≥ 0.19.3 n'est disponible sur npm. La version patchée est listée comme `<0.0.0` (inexistante en open-source).

---

## ✅ Solution proposée

Migrer vers **`exceljs`** (licence MIT, activement maintenu) qui offre :
- ✅ Support complet des fichiers Excel (.xlsx, .xls)
- ✅ Pas de vulnérabilités connues
- ✅ API moderne et bien documentée
- ✅ Support des styles, formules, graphiques
- ✅ Compatible Node.js et navigateurs

---

## 📋 Plan de migration

### 1. Installation
```bash
pnpm remove xlsx
pnpm add exceljs
```

### 2. Fichiers à modifier

| Fichier | Usage actuel |
|---|---|
| `app/api/admin/attestations/export-custom/route.ts` | Export Excel des attestations |
| `components/TranscriptTemplate.tsx` | (si utilisé pour l'export) |

### 3. Code actuel (xlsx)
```typescript
import * as XLSX from 'xlsx';

const worksheet = XLSX.utils.json_to_sheet(excelData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Attestations');
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
```

### 4. Code cible (exceljs)
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Attestations');

// Définir les colonnes
worksheet.columns = Object.keys(excelData[0]).map(key => ({
  header: key,
  key: key,
}));

// Ajouter les données
await worksheet.addRows(excelData);

const buffer = await workbook.xlsx.writeBuffer();
```

---

## 🧪 Tests requis

- [ ] Export Excel des attestations (admin)
- [ ] Vérifier le format du fichier généré
- [ ] Vérifier l'ouverture dans Excel/LibreOffice/Google Sheets
- [ ] Vérifier les performances sur de gros exports (>1000 lignes)
- [ ] Build passe sans erreur

---

## 📊 Estimation

- **Complexité** : Faible (API similaire)
- **Temps estimé** : 30-60 minutes
- **Risque** : Faible (changement isolé à 1-2 fichiers)

---

## 🔗 Références

- [exceljs GitHub](https://github.com/exceljs/exceljs)
- [exceljs npm](https://www.npmjs.com/package/exceljs)
- [SheetJS GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)
- [SheetJS GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)

---

**Priorité** : 🟡 Élevée (2 vulnérabilités non corrigées)
**Labels** : `security`, `dependencies`, `good first issue`
