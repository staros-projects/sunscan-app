# Brouillon GitBook — SUNSCAN v2.1.2

Brouillon de la refonte du site [sunscan.net](https://www.sunscan.net) pour la sortie de la v2.1.2 (application mobile + firmware + interface web). 16 pages, 8 en français et 8 en anglais, en markdown GitBook prêt à coller ou à importer.

Écrit à partir de `release-notes/v2.1.2.md` et `release-notes/v2.1.2_store.md` du dépôt `sunscan-app`, et du contenu actuel du site. **Aucune fonctionnalité, aucun libellé et aucun chiffre n'a été inventé** : tout vient des notes de version.

## Ce qu'il y a dans le dossier

```
gitbook-v2.1.2/
├── README.md                      ← ce fichier
├── plan-de-tournage-videos.md     ← les 30 séquences à tourner, par priorité
├── fr/                            ← espace GitBook FR (CodeYZviCVFTJOhtZhlK)
│   ├── a-propos/faq.md
│   └── utilisation/
│       ├── mobile-app-overview.md
│       ├── mobile-app-overview/nouveautes-de-la-version-2.1.2.md   ★ NOUVELLE PAGE
│       ├── observer.md
│       ├── retrieve-your-data.md
│       ├── editor/mobile-application.md
│       ├── editor/setup.md
│       └── share/integrations.md
└── en/                            ← espace GitBook EN (j8VBNLZ1OZic6lJdEMn0)
    ├── about/faq.md
    └── use/
        ├── mobile-app-overview.md
        ├── mobile-app-overview/whats-new-in-version-2.1.2.md       ★ NOUVELLE PAGE
        ├── observe.md
        ├── retrieve-your-data.md
        ├── editor/mobile-application.md
        ├── editor/setup.md
        └── share/integrations.md
```

L'arborescence reproduit exactement les URL du site : un fichier `fr/utilisation/editor/setup.md` va dans la page `https://www.sunscan.net/fr/utilisation/editor/setup`.

## Page par page

| Page | État actuel du site | Ce qui a été fait |
|------|---------------------|-------------------|
| **Nouveautés v2.1.2** / **What's New in v2.1.2** | n'existe pas | **Nouvelle page**, sur le modèle de celle de la v1.4 mais bien plus étoffée. 8 sections, 27 emplacements vidéo et 3 captures. C'est la pièce maîtresse. |
| **Aperçu de l'application mobile** | à jour pour la v1.x | Réécrite. Les 4 écrans sont conservés, avec les nouveaux boutons « Assist. », « Ident. » et « AUTO EXP », les filtres de galerie, le menu « ⋯ », le nouvel assistant de mise au point et les Réglages en cartes. L'encart de conseils de réglage (gain 1 dB, canal rouge en Hα…) est conservé tel quel. |
| **Observer** / **Observe** | une vidéo YouTube, rien d'autre | Écrite. La vidéo existante est conservée en tête. La page suit le déroulé d'une séance, avec l'assistant de scan comme fil conducteur, et se termine par les liens vers les trois pages filles. |
| **Configuration** / **Setup** | page vide (GIF décoratif) | Écrite de zéro. Mise à jour du firmware, connexion au Wi-Fi de la maison, découverte réseau, mode hotspot, compte SpectroSolHub, Réglages. |
| **Application mobile** / **Mobile application** | page vide (GIF décoratif) | Écrite de zéro. Où télécharger, Android 16, l'autorisation réseau local iOS, premier démarrage. Les liens App Store et Google Play sont ajoutés — ils manquaient partout sur le site. |
| **Partagez vos images** / **Share your images** | page vide | Écrite de zéro. Page complète sur SpectroSolHub : c'est le SUNSCAN qui envoie, connexion du compte, envoi d'un scan, envoi d'une addition, badges et filtre, et l'avertissement « envoyé ≠ sauvegardé ». |
| **Récupérez vos données** / **Retrieve your data** | à jour pour la v1.x | Réécrite. Les formats (PNG 16 bits, JPG, SER, journaux) sont conservés ; l'accès par hotspot devient le repli, l'« interface minimaliste » laisse place à la nouvelle interface web, et un encart distingue SpectroSolHub d'une vraie sauvegarde. Les 3 captures d'écran actuelles sont périmées : emplacements vides à remplir. |
| **FAQ** | 8 questions, dont un doublon | 7 questions conservées à l'identique, la 8e (doublon fautif de la 5e) supprimée, et une section « Version 2.1.2 » de 8 nouvelles entrées. |

Pages **non** touchées, mais à vérifier avant publication : `construction/2.-installation-du-sunscan-os` (l'image y est un lien Google Drive sans numéro de version, et aucune procédure de mise à jour n'est décrite), `construction/3.-configurer-et-ajuster` (tout est dans un PDF, non daté), et `utilisation/editor` (« Prepare », page vide).

## Les emplacements vidéo

Les vidéos ne sont pas tournées. Chaque emplacement est posé ainsi :

```
<!-- 🎬 V06 · Identification des raies spectrales · vidéo 40 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V06" %}
Légende déjà rédigée, en FR dans l'espace FR et en EN dans l'espace EN.
{% endembed %}
```

Une fois la vidéo en ligne : chercher/remplacer `PLACEHOLDER-V06` par l'identifiant YouTube, dans les deux espaces. Rien d'autre à changer.

Trois entrées (V13, V14, V28) sont des **images fixes** et utilisent un `<figure><img src="">` vide, précédé d'un commentaire `<!-- 📸 … -->` décrivant la capture attendue. Même chose pour les captures d'écran de l'interface web.

Le détail des 30 séquences — ce qu'on doit y voir, la durée, le format, la priorité et l'ordre de tournage conseillé — est dans **`plan-de-tournage-videos.md`**.

## Avant de publier

1. **La date en tête des deux pages de release** est fixée au `2026-09-19`. À remplacer par la vraie date de sortie.
2. **Le chiffre de performance du traitement** n'est volontairement pas donné : les notes de version portent un `TODO` à ce sujet. La page dit « beaucoup plus vite » et garantit des images identiques à la v1.4, sans chiffre. Si tu mesures un avant/après sur un Pi de référence, c'est la section ⚡ Performances qu'il faut compléter.
3. **Les liens App Store et Google Play** ont été ajoutés sur la page Application mobile. À vérifier : le lien App Store pointe sur la fiche `us`, à remplacer par un lien sans code pays si tu préfères.
4. **Le sommaire GitBook** : ajouter la nouvelle page sous « Aperçu de l'application mobile », à côté des pages 1.3 et 1.4, dans les deux espaces.
5. **Les slugs hérités du template** (`utilisation/editor` = « Préparer », `share/integrations` = « Partagez vos images », `observer/markdown` = « Le soleil en Hα »…) ont été **conservés** : les changer casserait les liens existants et les partages.
6. **Relire le vocabulaire EN** : `stack` pour addition, `spectral line` pour raie, `watermark` pour filigrane. C'est cohérent d'une page à l'autre, mais c'est ton vocabulaire qui fait foi.

## Pousser dans GitBook

Trois façons, par ordre de confort :

1. **Copier-coller** page par page dans l'éditeur GitBook. Le markdown GitBook (`{% hint %}`, `{% embed %}`, `{% stepper %}`, `<details>`) est reconnu au collage.
2. **Git Sync**, si les espaces sont synchronisés avec un dépôt : déposer les fichiers aux bons chemins et ouvrir une PR.
3. **API GitBook** : créer une change request sur chaque espace et y pousser les pages, puis relire et merger depuis l'interface. Les identifiants utiles : organisation `ybELmefpDZWKikBtZ7Zj`, site `site_JwsH0`, espace FR `CodeYZviCVFTJOhtZhlK`, espace EN `j8VBNLZ1OZic6lJdEMn0`.
