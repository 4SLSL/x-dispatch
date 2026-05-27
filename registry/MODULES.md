# Architecture de modules (minimaliste)

Objectif : ajouter un socle de modules **optionnels** avec le moins de code possible, sans coupler le cœur de l’application à un module métier.

## Ce que fait cette version

- Lit un manifest `x-dispatch-module.json`
- Installe un module externe depuis un ZIP
- Active/désactive un module à chaud (état persistant)
- Désinstalle un module externe
- Expose un onglet « Modules » dans Settings

## Ce que cette version ne fait pas (volontairement)

- Pas de renderer externe dynamique
- Pas de runtime spécifique (pas de hooks SIA/JFS/etc.)
- Pas de protocole custom module
- Pas d’installation GitHub directe

## Manifest minimal

```json
{
  "id": "example-module",
  "name": "Example Module",
  "version": "1.0.0",
  "kind": "external"
}
```

Fichier attendu : `x-dispatch-module.json` à la racine (ou dans un sous-dossier du ZIP, il est détecté automatiquement).

## Stockage

- Modules externes : `<userData>/community-modules/<id>/<version>/`
- État runtime : `<userData>/community-modules/modules-state.json`

## Pourquoi cette approche

1. **Diff minimal** : seulement l’infrastructure indispensable.
2. **Risque faible** : aucune dépendance à un module spécifique.
3. **Évolutif** : on peut ensuite ajouter les contributions UI/runtime par PR séparées.
