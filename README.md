# Wikhippo

Ton appli de révision pour Mac et Windows, par **@hippo.reporter**. Elle s’ouvre sur un petit GIF d’accueil (clique sur *Entrer* ou attends quelques secondes).

Tu déposes tes cours (PDF ou base Notion), Wikhippo en tire :
- des **fiches de synthèse** claires (Complète, Express ou Examen), exportables en **PDF** ou vers **Notion** ;
- des **cartes** qui reviennent au bon moment (révision espacée) ;
- des **quiz QCM** corrigés ;
- un mode **« Explique avec tes mots »** où l’appli te note et te montre ce qu’il manque.

---

## 1. Installer

### Sur Mac
1. Ouvre le fichier **Wikhippo-1.0.0.dmg** (choisis la version `arm64` si ton Mac est récent, M1 à M5, sinon la version Intel).
2. Glisse **Wikhippo** dans le dossier **Applications**.

### Sur Windows
1. Double-clique sur **Wikhippo Setup 1.0.0.exe**.
2. Suis l’installation (suivant, suivant, terminer).

---

## 2. Ouvrir l’appli malgré le blocage

Wikhippo n’est pas « signée » par Apple ni Microsoft (c’est payant, et ce n’est pas utile pour un projet perso). Ton ordinateur affiche donc un avertissement la première fois. Ce n’est pas un virus : il suffit de confirmer une fois.

### Mac : « Wikhippo ne peut pas être ouverte »
**Méthode 1 (la plus simple)**
1. Ouvre **Réglages Système → Confidentialité et sécurité**.
2. Descends en bas : tu vois « Wikhippo a été bloquée ». Clique sur **Ouvrir quand même**.
3. Entre ton mot de passe, puis **Ouvrir**.

**Méthode 2** : dans le dossier Applications, **clic droit sur Wikhippo → Ouvrir → Ouvrir**.

**Si Mac dit « Wikhippo est endommagée »** : ouvre l’app *Terminal* et colle :
```
xattr -cr /Applications/Wikhippo.app
```
puis relance l’appli.

### Windows : « Windows a protégé votre ordinateur »
1. Clique sur **Informations complémentaires**.
2. Clique sur **Exécuter quand même**.

---

## 3. Premier lancement : brancher l’IA

Clique sur **Réglages** (en haut à droite).

**Clé API Anthropic (obligatoire pour les fiches, cartes, quiz)**
1. Va sur **console.anthropic.com** et crée un compte.
2. Ajoute un peu de crédit (quelques euros suffisent pour beaucoup de fiches).
3. Menu **API Keys → Create Key**, copie la clé (elle commence par `sk-ant-`).
4. Colle-la dans Wikhippo, puis **Enregistrer**.

La clé est chiffrée et reste sur ton ordinateur. Chacun utilise sa propre clé : c’est elle qui est facturée.

**Notion (facultatif)**
1. Va sur **notion.so/profile/integrations** et crée une intégration interne.
2. Copie son jeton (« Secret ») et colle-le dans *Jeton d’intégration Notion*.
3. Dans Notion, ouvre ta **base de cours**, clique sur **… → Connexions** et ajoute ton intégration. Fais pareil avec la **page où tu veux recevoir tes fiches**.
4. Colle le lien de cette page dans *Page Notion où envoyer les fiches*.

---

## 4. Utiliser

1. **Crée une matière** (ex. « Histoire du cinéma ») ou **importe ta base Notion** depuis l’accueil : une matière est créée pour chaque valeur de la colonne « Matière ».
2. **Ajoute des cours** : glisse tes PDF dans la matière. (Un PDF scanné, sans texte, ne peut pas être lu.)
3. **Crée une fiche** : choisis un cours ou toute la matière, un format, puis *Créer la fiche*.
   - *Complète* : 2 à 3 pages ; *Express* : 1 page ; *Examen* : définitions, pièges, questions probables.
   - Tu peux la **modifier**, l’**exporter en PDF**, l’**envoyer vers Notion** ou la **copier**.
4. **Révise** :
   - **Cartes** : espace pour voir la réponse, puis `1` raté, `2` difficile, `3` facile. Plus tu réussis, plus la carte revient tard.
   - **Quiz QCM** : tes erreurs sont ajoutées à tes cartes.
   - **Explique avec tes mots** : réponds librement, l’appli te corrige.

Tes matières, fiches et cartes restent sur ton ordinateur.

---

## Pour les développeurs : fabriquer les installateurs

**Avec GitHub (sans rien installer)** : envoie ce dossier dans un dépôt, onglet *Actions → Build Wikhippo → Run workflow*, puis télécharge les fichiers dans *Artifacts*.

**Sur ta machine** (Node.js 20+) :
```
npm install
npm start        # lancer l’appli
npm run dist     # créer l’installateur de ton système dans dist/
```
Le `.dmg` se fabrique sur Mac, le `.exe` sur Windows.
