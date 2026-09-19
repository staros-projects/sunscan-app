# Plan de tournage — vidéos et captures v2.1.2

30 séquences. Chacune porte un identifiant `Vxx` qui apparaît tel quel dans les pages, sous la forme :

```
<!-- 🎬 V06 · Identification des raies spectrales · vidéo 40 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V06" %}
Légende.
{% endembed %}
```

Une fois la vidéo en ligne, un simple chercher/remplacer de `PLACEHOLDER-V06` par l'identifiant YouTube suffit. Les entrées marquées **capture** utilisent un `<figure><img src="">` vide au lieu d'un embed : il faut y coller l'URL GitBook de l'image après téléversement.

## Règles communes

- **Enregistrement d'écran du téléphone**, pas de filmage à la main, sauf V03 et V23 où le geste physique compte.
- **Format vertical 1080 × 1920**, 30 fps. Les GIF/webp peuvent descendre à 720 × 1280 et 15 fps pour rester sous 5 Mo.
- **Une seule idée par séquence.** Pas de voix off : la légende sous la vidéo suffit, et la doc est bilingue.
- **Masquer** : identifiants SpectroSolHub, adresse e-mail, SSID du domicile, position GPS exacte. Flouter ou utiliser un compte de démonstration.
- **Même scan de démonstration** d'une séquence à l'autre autant que possible — un beau Hα et un Ca II H propre suffisent pour presque tout.
- Commencer chaque prise **1 s avant** le geste et la finir **1 s après** le résultat, pour que la boucle GIF reste lisible.
- Pour les avant/après (V25, V26), tourner les deux prises **dans les mêmes conditions** (même scan, même Pi, même carte SD) et les monter côte à côte avec un titre « v1.4 » / « v2.1.2 ».

## Priorités

- **P1** — indispensable à la sortie : 12 séquences (V01, V02, V03, V04, V06, V07, V09, V12, V13, V17, V19, V20, V23, V29, V30).
- **P2** — à ajouter dans les jours qui suivent.
- **P3** — confort, si le temps le permet.

---

## Acquisition

| ID | Sujet | Format | Prio | Ce qu'on doit voir | Pages |
|----|-------|--------|------|--------------------|-------|
| **V01** | Trailer v2.1.2 | vidéo 60 s | P1 | Montage des meilleures séquences : splash animé, assistant de scan, identification des raies, aperçu du disque, envoi SpectroSolHub, interface web. À monter **en dernier**, à partir des rushes des autres séquences. | Release |
| **V02** | Assistant de scan — fenêtre d'observation | vidéo 30 s | P1 | Appui sur « Assist. » ; le panneau annonce la durée du scan, l'inclinaison du Soleil, la qualité du créneau et le créneau idéal. Tourner à une heure où la qualité n'est **pas** « idéale », puis montrer le créneau conseillé. | Release, Observer, Aperçu app |
| **V03** | Assistant de scan — placement du disque | vidéo 25 s | P1 | Guidage en direct : « Amenez le disque sur le repère » → le disque arrive sur le repère → « En place — lancez le scan ». Puis la jauge de temps restant pendant l'enregistrement. Filmer l'écran, le mouvement de la monture peut rester hors champ. | Release, Observer, Aperçu app |
| **V04** | Aperçu du disque en direct | GIF 10 s | P1 | La vignette où le disque se construit colonne par colonne. Accélérer ×2 si le scan est lent. | Release, Observer, Aperçu app |
| **V05** | Arrêt automatique du scan | GIF 12 s | P2 | Fin de passage du disque → apparition du compte à rebours 30 s → arrêt. Couper le compte à rebours au montage pour ne garder que le début et la fin. | Release, Observer, Aperçu app |
| **V06** | Identification des raies | vidéo 40 s | P1 | Appui sur « Ident. » en plein champ ; les étiquettes apparaissent ; zoomer pour montrer qu'elles suivent le zoom ; montrer les trois couleurs (ambre solaire, bleu tellurique, couleur pour les raies clés) et le bandeau plage / dispersion / nombre de raies. **Finir par un échec volontaire** (capot sur la fente) pour montrer le message d'explication. | Release, Observer, Aperçu app |
| **V07** | Exposition automatique | GIF 15 s | P1 | Plein champ couleur, image sur/sous-exposée → appui sur « AUTO EXP » → l'image se cale. | Release, Observer, Aperçu app |
| **V08** | Saisie du temps de pose | GIF 12 s | P2 | Mode recadré, appui **court** sur EXP → pavé numérique → saisie d'une valeur → validation. Enchaîner sur un appui long pour montrer la différence. | Release, Aperçu app |
| **V09** | Assistant de mise au point | vidéo 30 s | P1 | Barre de score qui passe du rouge à l'orange puis au vert pendant qu'on tourne la bague, courbe des 20 dernières secondes, « Nouveau meilleur ! », bouton de réinitialisation. | Release, Observer, Aperçu app |
| **V10** | Curseur de seuil de visualisation | GIF 10 s | P3 | Déplacement sur les petites valeurs, graduations visibles, passage en réglage fin. | Release, Aperçu app |
| **V11** | Fin de scan et choix de la raie | GIF 12 s | P2 | La fenêtre « Scan terminé » redessinée, puis le choix de la raie en pastilles colorées. | Release, Observer, Aperçu app |

## Traitement, galerie, images

| ID | Sujet | Format | Prio | Ce qu'on doit voir | Pages |
|----|-------|--------|------|--------------------|-------|
| **V12** | Progression réelle du traitement | GIF 20 s | P1 | La barre et les étapes qui défilent : lecture du scan, reconstruction, correction géométrique, surface, continuum, protubérances, Doppler, hélium. Accélérer ×2. | Release, Aperçu app |
| **V13** | Images Hε | capture | P1 | **Image fixe composite** : les trois images Hε (surface, couleur, protubérances) d'un même scan Ca II H, côte à côte, légendées. À préparer dans un éditeur, pas une capture d'écran. | Release |
| **V14** | Filigrane avec le nom de la raie | capture | P2 | Gros plan sur le coin d'une image : date + « Ca II H line - 3968 Å ». | Release |
| **V15** | Progression des additions | GIF 15 s | P2 | Barre d'addition : alignement des scans, écriture des images, création du GIF, avec le nombre de scans traités. | Release |
| **V16** | Raie des additions et animations | GIF 15 s | P2 | Sélection multiple dans l'onglet additions → menu → changement de raie sur plusieurs éléments → les badges colorés se mettent à jour. | Release |
| **V17** | Filtres de la galerie | vidéo 25 s | P1 | Bouton entonnoir → filtre par raie (montrer « Sans raie »), par état, par envoi → les compteurs sur les pastilles → « Tout sélectionner » sur un filtre actif. | Release, Aperçu app |
| **V18** | Galerie redessinée | GIF 15 s | P2 | Onglets en pilules, compteur, badges de raie, sélection multiple animée. | Release, Aperçu app |

## SpectroSolHub

| ID | Sujet | Format | Prio | Ce qu'on doit voir | Pages |
|----|-------|--------|------|--------------------|-------|
| **V19** | Connexion du compte | vidéo 25 s | P1 | Réglages → section SpectroSolHub → saisie des identifiants (**flouter**) → double authentification → compte connecté avec l'espace et le nombre d'images. Utiliser un compte de démonstration. | Release, Configuration, Partagez vos images |
| **V20** | Envoi d'un scan | vidéo 45 s | P1 | Écran d'un scan traité → bouton nuage → fenêtre d'envoi (images cochées par défaut, raie préremplie, titre, notes, publier / brouillon) → barre de progression → bouton qui ouvre l'observation sur le site. **Montrer aussi** la fermeture de la fenêtre pendant l'envoi puis le retour sur le scan. | Release, Partagez vos images |
| **V21** | Envoi d'une addition | vidéo 30 s | P2 | Bouton nuage sur une addition récente : date, raie, titre et note préremplis. Puis une addition ancienne : la demande de date et heure UTC, avec l'image dont le filigrane porte la date. | Release, Partagez vos images |
| **V22** | Badges nuage et filtre d'envoi | GIF 15 s | P2 | Galerie : nuage vert (publié) et nuage gris (brouillon) → toucher un nuage → filtre « Sur SpectroSolHub ». | Release, Partagez vos images |

## Connexion et mise à jour

| ID | Sujet | Format | Prio | Ce qu'on doit voir | Pages |
|----|-------|--------|------|--------------------|-------|
| **V23** | Wi-Fi de la maison | vidéo 40 s | P1 | Réglages → liste des réseaux (**flouter les SSID voisins**) → sélection → mot de passe → écran de bascule → l'application retrouve le SUNSCAN. **Montrer aussi un échec** (mauvais mot de passe) et le retour automatique en hotspot avec la cause affichée. | Release, Configuration |
| **V24** | Rechercher le SUNSCAN | GIF 15 s | P2 | Bouton « Rechercher le SUNSCAN » → découverte → connexion. Enchaîner sur la saisie manuelle de l'IP. | Release, Configuration |
| **V29** | Mise à jour du firmware | vidéo 30 s | P1 | Connexion d'un SUNSCAN en firmware ancien → la fenêtre s'affiche avec version installée et nouvelle version → lancement → redémarrage → confirmation de la version installée. Accélérer la phase d'attente. | Release, Configuration, Aperçu app |

## Performances

| ID | Sujet | Format | Prio | Ce qu'on doit voir | Pages |
|----|-------|--------|------|--------------------|-------|
| **V25** | Aperçu plus fluide (avant/après) | vidéo 20 s | P2 | Split screen v1.4 / v2.1.2 du même aperçu en direct, avec les titres de version incrustés. Même Pi, même carte SD, même distance au téléphone. | Release |
| **V26** | Traitement plus rapide (avant/après) | vidéo 20 s | P2 | Split screen du traitement du **même scan** en v1.4 et v2.1.2, chronomètre incrusté. Ne pas annoncer de chiffre dans la doc tant que la mesure n'est pas faite sur un Pi de référence. | Release |

## Interface

| ID | Sujet | Format | Prio | Ce qu'on doit voir | Pages |
|----|-------|--------|------|--------------------|-------|
| **V27** | Identité visuelle et écran de démarrage | GIF 10 s | P2 | La fente qui balaie le logo SUNSCAN, puis l'arrivée sur l'écran d'accueil. Excellente ouverture pour le trailer V01. | Release, Aperçu app |
| **V28** | Écran d'accueil | capture | P2 | Capture fixe : graphe de la course du Soleil, altitude, azimut, état de connexion au vert. Faire la capture avec un SUNSCAN connecté et un créneau d'observation crédible. | Release, Aperçu app, Application mobile |
| **V30** | Interface web du SUNSCAN | vidéo 40 s | P1 | **Enregistrement d'écran d'ordinateur**, 1920 × 1080. Navigation entre scans, additions, animations et snapshots → sélection multiple → visionneuse plein écran (zoom, rotation, aperçu FITS) → choix des types de fichiers avec les tailles → indicateurs de stockage et de batterie. | Release, Récupérez vos données |

---

## Ordre de tournage conseillé

1. **Une séance d'observation complète**, en enregistrement d'écran continu : V27 → V02 → V09 → V07 → V06 → V03 → V04 → V05 → V11. Presque tout se découpe dans ce seul rush.
2. **Au chaud, juste après** : V12 → V13 → V14 → V17 → V18 → V15 → V16.
3. **SpectroSolHub** : V19 → V20 → V21 → V22.
4. **Réseau et mise à jour**, avec un SUNSCAN volontairement laissé en firmware ancien : V29 → V23 → V24.
5. **Interface web**, depuis l'ordinateur : V30.
6. **Avant/après**, qui demandent de réinstaller la v1.4 sur une seconde carte SD : V25, V26.
7. **Montage du trailer V01** à partir de tout ce qui précède.

## Après mise en ligne

Pour chaque vidéo, dans les deux espaces GitBook (FR et EN) :

```
PLACEHOLDER-V02  →  identifiant YouTube
```

Les légendes sont déjà rédigées dans les deux langues, il n'y a rien à retraduire.
