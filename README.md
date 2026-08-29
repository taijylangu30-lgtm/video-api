# Magic Hour AI Video Generator Service

Service Backend Express.js & Intégration Goat Bot V2 pour générer des vidéos AI en utilisant l'API **Magic Hour**.

## 🚀 Fonctionnalités
- **Text to Video** : Génération vidéo à partir de descriptions textuelles.
- **Image to Video** : Animation d'images fixes via le workflow d'upload de Magic Hour.
- **Polling automatique** : Suivi de progression jusqu'à la récupération de l'URL MP4 finale.
- **Intégration Messenger** : Commande GoatBot V2 native (`!video`).

---

## 🔑 Obtenir une clé API Magic Hour

1. Créez un compte sur [https://magichour.ai](https://magichour.ai).
2. Rendez-vous dans le panneau Développeur : [https://magichour.ai/developer](https://magichour.ai/developer).
3. Générez une clé API (API Token) et copiez-la.

---

## 🛠️ Installation & Lancement Local

```bash
# Installation des dépendances
npm install

# Configuration de l'environnement
cp .env.example .env
# Mettez votre clé dans .env : MAGIC_HOUR_API_KEY=votre_cle_ici

# Lancement en développement
npm start
