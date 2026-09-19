# Nouveautés de la version 2.1.2

2026-09-19

La v2.1.2 est la plus grosse mise à jour de SUNSCAN depuis le lancement. Elle touche les trois étages du projet : l'application mobile, le firmware du SUNSCAN et son interface web. Au programme : l'envoi de vos images vers **SpectroSolHub** directement depuis l'application, un **assistant de scan** qui vous dit quand observer et vous guide pour placer le disque, l'**identification des raies** sur l'image live, la connexion du SUNSCAN au **Wi-Fi de la maison**, un enregistrement sans perte d'images, un traitement nettement plus rapide et une nouvelle interface.

<!-- 🎬 V01 · Trailer v2.1.2 · vidéo 60 s · voir plan-de-tournage-videos.md -->
{% embed url="https://youtu.be/PLACEHOLDER-V01" %}
Tour d'horizon de la version 2.1.2 en une minute.
{% endembed %}

{% hint style="warning" %}
**Mettez à jour votre SUNSCAN.**

La plupart des nouveautés ci-dessous, repérées par 🆙, ont besoin du **firmware 2.1.2**. L'application vous propose la mise à jour dès qu'elle détecte un SUNSCAN à mettre à jour, et elle reste disponible dans les **Réglages**. Elle est facultative, mais sans elle l'application sera très probablement instable.
{% endhint %}

## ✨ En bref

* **Envoi sur SpectroSolHub** : partagez vos images avec la communauté directement depuis l'application. 🆙
* **Filtres de la galerie** : par raie, par état de traitement et par envoi sur SpectroSolHub. 🆙
* **Images Hε** calculées automatiquement sur les scans Ca II H. 🆙
* **Raie des additions et des animations**, reprise des scans et modifiable. 🆙
* **Nom de la raie dans le filigrane** de toutes les images d'un scan. 🆙
* **Assistant de scan** : durée du scan, meilleur créneau horaire, et guidage en direct pour placer le disque.
* **Identification des raies spectrales** : le nom des raies s'affiche directement sur l'image live. 🆙
* **Aperçu du disque pendant l'enregistrement** et **arrêt automatique** du scan. 🆙
* **Progression réelle du traitement**, des additions et des animations, étape par étape. 🆙
* **Connexion du SUNSCAN au Wi-Fi de la maison**, avec détection automatique sur le réseau. 🆙
* **Exposition automatique** et **assistant de mise au point** entièrement refait.
* **Performances** : plus d'images perdues à l'enregistrement, traitement plus rapide, aperçu plus fluide. 🆙
* **Mise à jour du firmware en un geste**, proposée dès la connexion du SUNSCAN.
* **Nouvelle interface**, sur l'application comme sur l'interface web du SUNSCAN.

***

## 🔭 Acquisition

### Assistant de scan — bouton « Assist. »

**Avant le scan**, l'assistant s'appuie sur votre position GPS et les éphémérides. Il vous donne la durée du scan, l'inclinaison du Soleil, la qualité de la fenêtre d'observation à cette heure (idéale, bonne, exploitable, fortement inclinée…) et le créneau idéal. Il signale aussi quand le Soleil est sous l'horizon, et vous demande la position GPS s'il ne l'a pas.

<!-- 🎬 V02 · Assistant de scan — fenêtre d'observation, durée, créneau idéal · vidéo 30 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V02" %}
L'assistant annonce la durée du scan et la qualité du créneau avant même de lancer l'enregistrement.
{% endembed %}

**Placement du disque** : l'assistant vous guide en direct pour positionner le disque le long de la fente, afin qu'il reste centré pendant toute la traversée. Les messages sont explicites — « Amenez le disque sur le repère », « En place — lancez le scan ».

**Pendant l'enregistrement**, une jauge indique le temps restant et vous prévient quand le disque a fini de passer.

<!-- 🎬 V03 · Assistant de scan — guidage du placement du disque · vidéo 25 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V03" %}
Le guidage en direct pour amener le disque sur le repère, puis la jauge de progression du scan.
{% endembed %}

### Aperçu du disque en direct 🆙

Pendant le scan, une vignette montre le disque solaire se construire colonne par colonne. Vous savez tout de suite si le scan est bon, sans attendre le traitement.

<!-- 🎬 V04 · Aperçu du disque en direct pendant le scan · GIF 10 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V04" %}
Le disque se dessine colonne par colonne pendant l'enregistrement.
{% endembed %}

### Arrêt automatique du scan 🆙

Quand le disque a fini de passer, un compte à rebours de 30 s se lance, puis l'enregistrement s'arrête tout seul. Un toucher sur le compte à rebours l'annule si vous voulez continuer.

<!-- 🎬 V05 · Arrêt automatique du scan · GIF 12 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V05" %}
Le compte à rebours de 30 s, puis l'arrêt automatique de l'enregistrement.
{% endembed %}

### Identification des raies spectrales — bouton « Ident. » 🆙

En mode plein champ, mono ou couleur, l'application reconnaît quelle portion du spectre solaire est à l'écran — un peu comme un « plate solving » du spectre. Le nom des raies s'affiche directement sur l'image, et les étiquettes suivent le zoom :

* raies solaires en **ambre** ;
* raies telluriques en **bleu** ;
* raies clés en **couleur** (Hα, Na D, Mg b, Ca II H & K…).

Un bandeau indique la plage de longueurs d'onde, la dispersion (Å/px) et le nombre de raies identifiées. Si l'identification échoue, il en explique la raison : manque de lumière, saturation, mise au point…

<!-- 🎬 V06 · Identification des raies spectrales · vidéo 40 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V06" %}
Les noms des raies s'affichent sur l'image live et suivent le zoom.
{% endembed %}

### Exposition automatique — bouton « AUTO EXP »

En mode plein champ couleur, le temps de pose s'ajuste automatiquement. Le réglage est mémorisé, et l'exposition est figée dès que vous lancez l'enregistrement.

<!-- 🎬 V07 · Exposition automatique (AUTO EXP) · GIF 15 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V07" %}
Le temps de pose se cale tout seul en mode plein champ couleur.
{% endembed %}

### Saisie du temps de pose — appui court sur « EXP »

En mode recadré, où le temps de pose se règle entièrement à la main, un appui court sur **EXP** ouvre un pavé numérique : vous tapez la valeur en millisecondes (de 0,1 à 30 000 ms) au lieu de la chercher au curseur. Pratique pour retrouver exactement une exposition qui fonctionne, d'une séance à l'autre.

Un petit tutoriel présente les deux gestes de la tuile EXP — appui court pour la saisie, appui long pour changer de plage — la première fois que vous ouvrez les réglages en mode recadré.

<!-- 🎬 V08 · Saisie du temps de pose au pavé numérique · GIF 12 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V08" %}
Appui court sur EXP : le pavé numérique s'ouvre, la valeur se tape directement.
{% endembed %}

### Assistant de mise au point, entièrement refait

* Barre en pourcentage du meilleur score, en vert, orange ou rouge.
* Courbe des 20 dernières secondes.
* Indication « Nouveau meilleur ! ».
* Bouton de réinitialisation.
* Guide en 3 étapes.

Le score est lissé : une image chanceuse ne fixe plus un record inatteignable.

<!-- 🎬 V09 · Assistant de mise au point · vidéo 30 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V09" %}
La barre de score, la courbe des 20 dernières secondes et l'indication « Nouveau meilleur ! ».
{% endembed %}

### Et aussi

* **Nouveau curseur de seuil de visualisation** : plus précis sur les petites valeurs, avec des graduations et un mode de réglage fin.
* **Recadrage** : si vous appuyez sur REC avant d'avoir recadré, une bulle vous indique le bouton de recadrage.
* **Boutons REC et recadrage** : un indicateur de chargement s'affiche, ce qui évite le double appui. Le chrono d'enregistrement a été redessiné.
* **Caméra non connectée** : un panneau clair s'affiche avec un bouton « Connecter la caméra », au lieu d'un chargement sans fin. L'heure du téléphone est synchronisée au passage.
* **Fin de scan** : la fenêtre « Scan terminé » a été redessinée, avec le choix de la raie sous forme de pastilles colorées.
* **Correction** : quand le stockage était presque plein, il devenait impossible d'arrêter le scan.

<!-- 🎬 V10 · Curseur de seuil de visualisation · GIF 10 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V10" %}
Le nouveau curseur de seuil, avec ses graduations et son mode de réglage fin.
{% endembed %}

<!-- 🎬 V11 · Fenêtre de fin de scan et choix de la raie · GIF 12 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V11" %}
La fenêtre « Scan terminé » redessinée et le choix de la raie en pastilles colorées.
{% endembed %}

***

## 🖼️ Traitement, galerie et images

### Progression réelle du traitement 🆙

Une barre de progression s'affiche, avec l'étape en cours : lecture du scan, reconstruction du disque, correction géométrique, puis surface, continuum, protubérances, Doppler et hélium.

En cas d'échec, la raison est affichée — par exemple : scan trop court, ou pas de Soleil. Un traitement lancé avant de changer d'écran, ou de fermer l'application, est retrouvé automatiquement.

<!-- 🎬 V12 · Progression réelle du traitement · GIF 20 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V12" %}
Le traitement affiche enfin l'étape en cours et sa progression réelle.
{% endembed %}

### Images Hε 🆙

La raie Hε (3970,08 Å) se trouve dans l'aile rouge de Ca II H : le traitement d'un scan tagué **Ca II H** calcule maintenant automatiquement trois images Hε en plus — **surface**, **couleur** et **protubérances** — sans rien changer aux autres. Comptez environ 4 s de traitement en plus.

La raie Hε est vérifiée dans le spectre lui-même, pas seulement d'après le tag : un scan Ca II K tagué Ca II H par erreur ne produit pas d'images Hε.

Si vous taguez Ca II H un scan déjà traité, l'application vous propose de le retraiter pour les obtenir.

<!-- 📸 V13 · Capture : trio d'images Hε (surface, couleur, protubérances) issues d'un même scan Ca II H, côte à côte -->
<figure><img src="" alt=""><figcaption>Les trois images Hε calculées automatiquement sur un scan Ca II H.</figcaption></figure>

### Nom de la raie dans le filigrane 🆙

Le filigrane des images d'un scan indique maintenant la raie après la date — par exemple « Ca II H line - 3968 Å » — sur la surface, la couleur, le négatif, les protubérances et le Doppler, comme c'était déjà le cas pour les additions et les animations. Un scan sans raie, ou tagué « Autre », garde la date seule.

{% hint style="info" %}
Le filigrane est écrit au traitement : retraitez un scan plus ancien pour y ajouter la raie.
{% endhint %}

<!-- 📸 V14 · Capture : gros plan sur le coin d'une image montrant le filigrane « date + Ca II H line - 3968 Å » -->
<figure><img src="" alt=""><figcaption>Le filigrane porte désormais le nom de la raie.</figcaption></figure>

**Correction** : après un changement de raie suivi d'un retraitement, les images de l'ancienne raie qui n'existent pas pour la nouvelle (négatif, couleur) restaient sur le SUNSCAN. Elles sont maintenant supprimées.

### Additions et animations

* **Progression réelle** : une barre en pourcentage et l'étape en cours — alignement des scans, écriture des images, création du GIF — avec le nombre de scans traités. Les échecs sont gérés au lieu de bloquer l'écran. 🆙
* **Raie des additions et des animations** : elles reprennent la raie de leurs scans à leur création, affichent son badge coloré dans la galerie, et se filtrent par raie comme les scans. La raie se change depuis le menu « ⋯ », ou pour plusieurs éléments à la fois depuis la sélection multiple de la galerie — pratique pour renseigner celles créées avant cette version. 🆙
* **Nouvelles images couleur empilées.** 🆙
* Les additions et les animations affichent la **date de l'observation** (l'heure moyenne des scans pour une addition, le premier scan pour une animation), et non plus celle de leur création. Pour celles créées avant cette version, c'est toujours la date de création. 🆙
* Les actions (téléchargement, suppression, et « Voir sur SpectroSolHub » pour une addition) sont regroupées dans un menu « ⋯ », comme sur l'écran d'un scan. 🆙
* Durée par défaut d'une image d'animation : **160 ms** (au lieu de 120 ms).
* **Correction** : l'image couleur « brute » d'une addition était en fait l'image renforcée. Elle est maintenant tirée de l'addition brute. Les additions déjà faites ne sont pas refaites — additionnez à nouveau les scans pour l'obtenir. 🆙
* **Correction** : l'image négative était mal générée sur les additions et les animations. 🆙
* **Correction** : la date de création d'une addition ou d'une animation changeait dès qu'un fichier était ajouté à son dossier. 🆙

<!-- 🎬 V15 · Progression des additions et des animations · GIF 15 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V15" %}
L'addition affiche l'étape en cours et le nombre de scans traités.
{% endembed %}

<!-- 🎬 V16 · Raie des additions et des animations · GIF 15 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V16" %}
Changer la raie de plusieurs additions d'un coup depuis la sélection multiple.
{% endembed %}

### Filtres de la galerie — bouton entonnoir 🆙

Dans l'onglet **Scans**, filtrez vos scans :

* **par raie** (avec une pastille « Sans raie ») ;
* **par état** : traités, non traités, en échec ;
* **par envoi** : « Sur SpectroSolHub », « Pas encore envoyés ».

Chaque pastille indique le nombre de scans qu'elle donnerait. Une fois un filtre actif, « Tout sélectionner » sélectionne d'un coup tous les scans filtrés, pour les additionner, les animer ou les supprimer.

<!-- 🎬 V17 · Filtres de la galerie · vidéo 25 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V17" %}
Filtrer par raie, par état et par envoi, puis tout sélectionner d'un coup.
{% endembed %}

### Galerie redessinée

* Onglets en pilules et compteur d'éléments.
* Vignettes arrondies et badges de raie colorés.
* Sélection multiple animée.
* Message quand la galerie est vide.
* **Écran d'un scan allégé** : les actions secondaires (raie, vue 3D, informations, traitement, téléchargement, suppression) sont regroupées dans un menu « ⋯ ». La raie se choisit dans la même grille de pastilles colorées qu'en fin de scan, même sans SUNSCAN connecté.
* **Correction** : le cadre de sélection des vignettes ne suivait pas exactement l'arrondi de l'image.

<!-- 🎬 V18 · Galerie redessinée et sélection multiple · GIF 15 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V18" %}
Onglets en pilules, badges de raie colorés et sélection multiple animée.
{% endembed %}

### Téléchargement des images

* Un message s'affiche en cas d'échec. Une page d'erreur n'est plus enregistrée comme image.
* Sur iOS, les images sont rangées dans un album **SUNSCAN**.
* **Correction** : le zoom est réinitialisé quand on change d'image.

***

## ☁️ SpectroSolHub 🆙

[SpectroSolHub](https://spectrosolhub.com) est la plateforme de partage de la communauté des spectrohéliographes. Vous pouvez maintenant y envoyer vos scans **sans passer par un ordinateur**.

<!-- 🎬 V20 · SpectroSolHub — envoi d'un scan · vidéo 45 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V20" %}
Du bouton nuage à l'observation publiée sur SpectroSolHub.
{% endembed %}

{% hint style="info" %}
**C'est le SUNSCAN qui envoie, pas le téléphone.** Il doit donc avoir accès à internet : connectez-le au Wi-Fi de la maison. Depuis son hotspot, rien ne peut partir, et l'application vous le signale.
{% endhint %}

### Se connecter

Depuis les **Réglages**, section SpectroSolHub, saisissez vos identifiants. La double authentification est prise en charge. Le mot de passe n'est jamais conservé : le SUNSCAN l'échange contre un jeton d'accès, que vous pouvez révoquer depuis votre compte sur le site. Les Réglages affichent aussi l'espace et le nombre d'images utilisés sur votre compte.

<!-- 🎬 V19 · SpectroSolHub — connexion du compte · vidéo 25 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V19" %}
Connexion du compte SpectroSolHub depuis les Réglages.
{% endembed %}

### Envoyer un scan

Sur l'écran d'un scan traité, le **bouton nuage** ouvre la fenêtre d'envoi :

* choisissez les images à envoyer — les plus utiles sont cochées par défaut ;
* vérifiez la raie : elle est préremplie d'après le tag du scan, mais vous pouvez la corriger ;
* donnez un titre et des notes si vous le souhaitez ;
* publiez tout de suite, ou gardez l'observation en brouillon pour la publier plus tard depuis le site.

Une barre de progression indique l'étape en cours et l'image envoyée. Vous pouvez fermer la fenêtre : le SUNSCAN continue l'envoi, et l'application le retrouve en revenant sur le scan. Une coupure Wi-Fi brève ne fait pas échouer l'envoi. À la fin, un bouton ouvre l'observation sur le site.

Chaque envoi crée une nouvelle observation : l'application vous prévient si le scan a déjà été envoyé.

### Envoyer une addition

Le même bouton nuage est présent sur l'écran d'une addition. Pour celles créées avec cette version, la date, la raie, le titre et une note sont préremplis d'après les scans d'origine : la date est l'heure moyenne des scans — celle écrite dans le filigrane — et le nom de l'observateur est celui donné lors de l'addition.

Pour les plus anciennes, le dossier ne porte que la date de création, pas celle de l'observation : l'application vous demande la date et l'heure (UTC) de l'observation, préremplies avec la date de création, en affichant l'image dont le filigrane contient la date pour la vérifier.

L'envoi des animations n'est pas encore proposé.

<!-- 🎬 V21 · SpectroSolHub — envoi d'une addition · vidéo 30 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V21" %}
L'envoi d'une addition, avec la date et la raie préremplies d'après les scans d'origine.
{% endembed %}

### Retrouver et faire le ménage

Les scans et additions envoyés portent un petit nuage dans la galerie : **vert** si l'observation a été publiée, **gris** si elle est restée en brouillon. Un toucher sur le nuage ouvre l'observation, tout comme « Voir sur SpectroSolHub » dans le menu « ⋯ » de l'écran du scan. Le filtre « Sur SpectroSolHub », disponible aussi dans l'onglet additions, permet de n'afficher que ces éléments — par exemple pour les supprimer du SUNSCAN. Un envoi qui a échoué en cours de route ne compte pas comme envoyé.

<!-- 🎬 V22 · SpectroSolHub — badges nuage et filtre d'envoi · GIF 15 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V22" %}
Les badges nuage dans la galerie et le filtre « Sur SpectroSolHub ».
{% endembed %}

{% hint style="danger" %}
**« Envoyé » ne veut pas dire « sauvegardé ».**

Seules les images JPEG choisies partent sur le hub. Le fichier SER, les FITS et les PNG 16 bits restent sur le SUNSCAN : supprimer un scan envoyé, c'est perdre ses données brutes, et il ne pourra plus être retraité. L'application vous le rappelle au moment de la suppression.
{% endhint %}

[Tout le détail sur la page **Partagez vos images** →](../share/integrations.md)

***

## 📶 Connexion

### Connecter le SUNSCAN au Wi-Fi de la maison 🆙

Depuis les **Réglages**, le SUNSCAN peut rejoindre votre réseau Wi-Fi au lieu d'utiliser son propre hotspot :

{% stepper %}
{% step %}
### Choisir le réseau

Sélectionnez un réseau dans la liste, ou saisissez un réseau caché.
{% endstep %}

{% step %}
### Laisser l'application guider la bascule

Elle vous accompagne pendant le changement de réseau.
{% endstep %}

{% step %}
### Retrouver le SUNSCAN

L'application le redétecte automatiquement sur le réseau.
{% endstep %}
{% endstepper %}

**En cas d'échec**, le SUNSCAN repasse de lui-même en hotspot et la cause est affichée : mauvais mot de passe, réseau introuvable…

**Réseaux enregistrés** : le SUNSCAN les rejoint automatiquement au démarrage. Vous pouvez les oublier depuis les Réglages, ou revenir au hotspot.

<!-- 🎬 V23 · Connecter le SUNSCAN au Wi-Fi de la maison · vidéo 40 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V23" %}
Le SUNSCAN rejoint le réseau de la maison, puis l'application le retrouve toute seule.
{% endembed %}

### Rechercher le SUNSCAN sur le réseau

Le bouton « Rechercher le SUNSCAN » trouve l'appareil automatiquement sur votre réseau. Vous pouvez aussi saisir son adresse IP à la main.

<!-- 🎬 V24 · Rechercher le SUNSCAN sur le réseau · GIF 15 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V24" %}
Découverte automatique du SUNSCAN sur le réseau local.
{% endembed %}

### Et aussi

* **Correction** : l'état « SUNSCAN connecté » restait affiché après une perte de connexion.
* **Correction** : certains téléphones, notamment Xiaomi, ne pouvaient pas se connecter au hotspot. 🆙

[Tout le détail sur la page **Configuration** →](../editor/setup.md)

***

## ⚡ Performances 🆙

### Plus aucune image perdue pendant l'enregistrement

L'écriture du fichier SER sur la carte SD se fait maintenant séparément de la capture. Une carte SD lente ou un ralentissement ponctuel ne fait plus perdre d'images, et l'écriture de chaque image est beaucoup plus légère.

Si la caméra est coupée en plein enregistrement, le fichier SER est quand même fermé proprement.

### Traitement des scans plus rapide, résultats identiques

Les étapes de traitement les plus coûteuses ont été réécrites pour aller beaucoup plus vite sur le Raspberry Pi : image moyenne, reconstruction du disque, détection du bord, circularisation et correction du tilt.

{% hint style="success" %}
Les images produites sont **strictement identiques** à celles de la v1.4. Seul le temps de calcul change.
{% endhint %}

<!-- 🎬 V26 · Traitement plus rapide (avant/après) · vidéo 20 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V26" %}
Le même scan traité en v1.4 et en v2.1.2, côte à côte.
{% endembed %}

### Aperçu en direct plus fluide

* L'économie d'énergie Wi-Fi du Pi est désactivée : elle provoquait latence et saccades.
* La capture et l'enregistrement passent en priorité haute.
* Les tâches de maintenance du système, qui pouvaient saturer la carte SD en plein scan, sont désactivées.

<!-- 🎬 V25 · Aperçu en direct plus fluide (avant/après) · vidéo 20 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V25" %}
La latence de l'aperçu en direct, avant et après la mise à jour.
{% endembed %}

### La galerie ne ralentit plus la capture

* Les téléchargements sont générés à la volée, sans rien écrire sur la carte SD.
* Les miniatures sont mises en cache.
* Le travail disque de la galerie tourne en priorité basse.

Vous pouvez donc télécharger des fichiers pendant un scan sans perdre d'images.

***

## 🎨 Interface et réglages

### Nouvelle identité visuelle

* Nouvel écran de démarrage animé : une fente balaie le logo SUNSCAN avant l'ouverture de l'application.
* Thème unifié avec un accent vert émeraude.
* Animations sur les boutons et la barre de navigation.
* Fenêtres harmonisées.

<!-- 🎬 V27 · Nouvelle identité visuelle et écran de démarrage · GIF 10 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V27" %}
La fente qui balaie le logo au lancement de l'application.
{% endembed %}

### Écran d'accueil

* Graphe de la course du Soleil redessiné.
* Altitude et azimut du Soleil affichés.
* Alerte quand l'espace libre descend sous 5 Go.

<!-- 📸 V28 · Capture : écran d'accueil avec le graphe de la course du Soleil, altitude et azimut -->
<figure><img src="" alt=""><figcaption>Le nouvel écran d'accueil.</figcaption></figure>

### Mise à jour du firmware

* **Proposée dès la connexion** : quand l'application détecte un SUNSCAN à mettre à jour, une fenêtre affiche la version installée et la nouvelle, et lance la mise à jour directement, sans passer par les Réglages. Elle reste facultative (« Plus tard »), mais sans elle l'application sera très probablement instable. La fenêtre n'apparaît qu'une fois par session.
* **Plus fiable** : l'application attend le redémarrage du SUNSCAN et vérifie la version installée avant d'annoncer le résultat.

<!-- 🎬 V29 · Mise à jour du firmware en un geste · vidéo 30 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V29" %}
La mise à jour du firmware proposée dès la connexion du SUNSCAN.
{% endembed %}

### Réglages et langues

L'écran des Réglages est réorganisé en cartes, et les langues se choisissent maintenant par boutons.

### Interface web du SUNSCAN, entièrement refaite 🆙

* Une seule navigation pour les scans, additions, animations et snapshots, avec sélection multiple, téléchargement et suppression.
* Visionneuse plein écran : zoom, rotation, aperçu des FITS.
* Choix des types de fichiers à télécharger, avec leur taille affichée à l'avance.
* Indicateurs d'espace de stockage et de batterie.

<!-- 🎬 V30 · Interface web du SUNSCAN · vidéo 40 s -->
{% embed url="https://youtu.be/PLACEHOLDER-V30" %}
La nouvelle interface web du SUNSCAN, depuis un ordinateur.
{% endembed %}

[Tout le détail sur la page **Récupérez vos données** →](../retrieve-your-data.md)

***

## 📱 Plateforme

* **Android** : l'application cible Android 16 (SDK 36), comme l'exige Google Play.
* **iOS** : l'application demande l'accès au réseau local, nécessaire pour trouver le SUNSCAN sur votre Wi-Fi.

***

## Pour aller plus loin

* [Aperçu de l'application mobile](../mobile-app-overview.md)
* [Configuration](../editor/setup.md)
* [Observer](../observer.md)
* [Partagez vos images](../share/integrations.md)
* [Récupérez vos données](../retrieve-your-data.md)

{% hint style="success" %}
Une question, un bug, une première image à montrer ? Rejoignez-nous sur le [Discord SUNSCAN](https://discord.gg/TNGKj3cQmr). 🌞
{% endhint %}
