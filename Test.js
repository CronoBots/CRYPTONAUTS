// Puppeteer n'est plus nécessaire : on utilise désormais l'API GraphQL directement
// (même approche que le panel Snapshot dans index.html) — beaucoup plus rapide et fiable.
const axios = require('axios');
const fs = require('fs');

// Liste des identifiants de collections avec option process, usePagination, noms et images
const collections = [
  { id: 'aabff17f9874020416137984b9d2b8db', name: 'Legendary Cryptonauts V2', process: true, usePagination: false, image: 'https://media.nft.crypto.com/58a7e1a7-392b-4589-8fb1-39ede948877f/original.jpg?d=lg-logo' },
  { id: '0a9144ea31f81338454f87a1eaf101c1', name: 'OG Cryptonauts', process: true, usePagination: false, image: 'https://media.nft.crypto.com/ed44387d-7a86-4f00-aaf4-bdc48170f5ab/original.jpg?d=lg-logo' },
  { id: 'a870c453ec57dc8e706e999b3f37a859', name: 'Time Travel Cryptonauts II', process: true, usePagination: false, image: 'https://media.nft.crypto.com/d2ed798c-06b3-415c-bedf-2eb7e85696a2/original.jpg?d=lg-logo' },
  { id: 'c220b3299c59deccf1340251036ac4ac', name: 'Legendary Cryptonauts', process: true, usePagination: false, image: 'https://media.nft.crypto.com/a4473840-5dce-4b64-ae66-1e265d41efce/original.jpg?d=lg-logo' },
  { id: '98d9a2bfd53bd130fc267c9c92ed3236', name: 'TIME TRAVEL Cryptonauts', process: true, usePagination: true, image: 'https://media.nft.crypto.com/3f03eae4-d4db-4ec8-96cd-ff53a95403d0/original.jpg?d=lg-logo5' },
  { id: '89d7138226413ae153f306dd5cfabf33', name: 'Quantum Cryptonauts V2', process: true, usePagination: true, image: 'https://media.nft.crypto.com/c19a171b-0418-4eb2-b3c1-1dcb84616c52/original.jpg?d=lg-logo' },
  { id: 'bbcd969a80642cf8934d33061be8a194', name: 'Quantum Cryptonauts', process: true, usePagination: true, image: 'https://media.nft.crypto.com/395953dd-72fe-49ba-acb0-f638166b87ae/original.jpg?d=lg-logo' },
  { id: '10615ea6d69edfc24975c419941304e3', name: 'Cryptonauts 2024', process: true, usePagination: true, image: 'https://media.nft.crypto.com/84f5f042-7cb0-404f-88d2-43d07a6d2a46/original.jpg?d=lg-logo' },
  { id: 'f1d242e1c49e009427b38fc953ef4e89', name: 'Cryptonauts Golden Crew', process: true, usePagination: false, image: 'https://media.nft.crypto.com/6d6e7a76-35f6-4918-b851-ddebabf94e2c/original.jpg?d=lg-logo' },
  { id: 'da522f33fb5285981f6d154e575fe0a3', name: 'Cryptonauts: The dark side of the dune', process: true, usePagination: true, image: 'https://media.nft.crypto.com/f3bdf36b-403b-4799-a39f-2c21cea5dc99/original.jpg?d=lg-logo' },
  { id: 'c942e9924b01fae996d8f817060611eb', name: 'Cryptonauts', process: true, usePagination: true, image: 'https://media.nft.crypto.com/5057c430-e7f5-4462-a6d2-7bb2bfb68700/original.jpg?d=lg-logo' },
];

// Générer les URLs des collections à traiter (uniquement celles avec process: true)
const collectionUrls = collections
  .filter(collection => collection.process)
  .map(collection => ({
    url: `https://crypto.com/nft/collection/${collection.id}`,
    usePagination: collection.usePagination
  }));

// Fonction de délai personnalisée
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour nettoyer le nom de la collection pour les IDs HTML
function cleanFileName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Fonction pour assigner les rangs (gold, silver, bronze) aux trois premiers propriétaires
function assignRanks(owners) {
  const sortedOwners = [...owners].sort((a, b) => b[1] - a[1]);
  let currentRank = 1;
  let previousCount = null;
  return sortedOwners.map(([name, count], index) => {
    if (index > 0 && count < previousCount) {
      currentRank += 1;
    }
    previousCount = count;
    let rank = null;
    let rankClass = '';
    if (currentRank === 1) {
      rank = 'gold';
      rankClass = 'rank-1';
    } else if (currentRank === 2) {
      rank = 'silver';
      rankClass = 'rank-2';
    } else if (currentRank === 3) {
      rank = 'bronze';
      rankClass = 'rank-3';
    }
    return { name, url: `https://crypto.com/nft/profile/${name}`, count, rank, rankClass };
  });
}

// Fonction pour charger Owners.json
function loadOwnersJson() {
  try {
    if (fs.existsSync('Owners.json')) {
      const data = fs.readFileSync('Owners.json', 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error loading Owners.json:', error.message);
    return {};
  }
}

// Fonction pour sauvegarder Owners.json
function saveOwnersJson(ownersData) {
  try {
    fs.writeFileSync('Owners.json', JSON.stringify(ownersData, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving Owners.json:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL — endpoint + queries (alignées sur le panel Snapshot de index.html)
// ─────────────────────────────────────────────────────────────────────────────
const GQL_ENDPOINT = 'https://crypto.com/nft-api/graphql';

// En-têtes communs à tous les appels (évite de recréer l'objet à chaque requête)
const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
};

// Nombre de tâches par-asset menées EN PARALLÈLE (étapes 2.5, 3 et Twitter).
// Ne contrôle PAS le débit (c'est le rôle de rateGate) mais le nombre de
// requêtes en vol simultanément, ce qui masque la latence réseau.
const CONCURRENCY = 6;

// Exécute `worker` sur chaque item avec au plus `limit` tâches simultanées.
// Conserve l'ordre des résultats (results[i] correspond à items[i]).
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

// ── LIMITEUR DE DÉBIT GLOBAL ─────────────────────────────────────────────────
// crypto.com renvoie des 429 (Too Many Requests) dès que le DÉBIT global est
// trop élevé — peu importe le nombre de workers. La concurrence (CONCURRENCY)
// sert juste à masquer la latence ; c'est CE limiteur qui plafonne le débit
// réel à ~1 requête / MIN_REQUEST_INTERVAL_MS, ce qui reproduit l'enveloppe de
// l'ancienne version séquentielle (jamais bloquée) tout en évitant d'attendre
// la réponse avant de lancer la suivante.
const MIN_REQUEST_INTERVAL_MS = 200; // ≈ 5 req/s : débit de l'ancienne version (jamais bloquée)
let _nextRequestSlot = 0;
async function rateGate() {
  const now = Date.now();
  const slot = Math.max(now, _nextRequestSlot);
  _nextRequestSlot = slot + MIN_REQUEST_INTERVAL_MS; // réservation atomique (pas d'await avant)
  const wait = slot - now;
  if (wait > 0) await delay(wait);
}

// Helper générique pour les appels GraphQL, avec retry sur erreurs HTTP
// transitoires (réseau / 429 / 5xx). Les erreurs GraphQL *logiques* ne sont PAS
// retentées (inutile) — elles remontent immédiatement à l'appelant.
async function gql(operationName, variables, query, retries = 6) {
  let attempt = 0;
  while (true) {
    try {
      await rateGate(); // espacement global anti-429
      const res = await axios.post(GQL_ENDPOINT, { operationName, variables, query }, {
        timeout: 20000,
        headers: HTTP_HEADERS
      });
      if (res.data?.errors) {
        const e = new Error(`GraphQL Error: ${res.data.errors.map(e => e.message).join(', ')}`);
        e.graphqlLogic = true; // erreur métier → non-retryable
        throw e;
      }
      return res.data?.data;
    } catch (err) {
      const status = err.response?.status;
      // 429 (Too Many Requests) / 403 / 5xx / erreurs réseau → retry avec backoff
      // exponentiel + jitter. Le backoff long (jusqu'à ~12 s) laisse le temps à
      // un ban temporaire de se lever ; le jitter évite que tous les workers du
      // pool ne retentent au même instant (effet « thundering herd »).
      const retryable = !err.graphqlLogic &&
        (!err.response || status === 429 || status === 403 || (status >= 500 && status < 600));
      if (attempt < retries && retryable) {
        const base = Math.min(12000, 500 * Math.pow(2, attempt)); // 0.5s,1s,2s,4s,8s,12s
        await delay(base + Math.floor(Math.random() * 400));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

// Infos collection (nom + métriques officielles : items / owners / editionsCount)
const Q_COLLECTION_INFO = `query SnapCollectionInfo($collectionId:ID!){
  public{collection(id:$collectionId){
    id name
    metrics{ items owners editionsCount }
  }}}`;

// Étape 1 : historique des transferts → propriétaire actuel de chaque asset transféré
const Q_HISTORY = `query SnapHistory($collectionId:ID!,$first:Int!,$after:String,$naturesIn:[String!]){
  public{collection(id:$collectionId){id eventHistory(first:$first,after:$after,naturesIn:$naturesIn){
    edges{node{id asset{id name copies}
    user{username uuid}
    toUser{username uuid}
    nature}}
    pageInfo{endCursor hasNextPage}}}}}`;

// Étape 2 : tous les assets de la collection (avec copies + copiesInCirculation + edition IDs)
const Q_ALL_ASSETS = `query SnapAllAssets($collectionId:ID,$first:Int!,$skip:Int!){
  public{assets(collectionId:$collectionId,first:$first,skip:$skip){
    id name copies copiesInCirculation
    offerableEditionId
    defaultListingV2{ editionId }
    latestPurchasedEdition{ id }
  }}}`;

// Étape 2.5 : pour les NFTs multi-éditions → toutes les éditions et leurs propriétaires
const Q_EDITIONS_BY_ASSET = `query SnapEditionsByAsset($assetId:ID!,$first:Int,$skip:Int,$isDropLast:Boolean){
  public{editions(assetId:$assetId,first:$first,skip:$skip,isDropLast:$isDropLast){
    totalCount
    editions{ id index owner{ uuid username } }
  }}}`;

// Étape 3 : pour les single-éditions sans historique de transfert → owner via edition(id)
const Q_EDITION_OWNER = `query SnapEdition($id:ID!){
  public{edition(id:$id){id owner{ uuid username } }}}`;

// GraphQL query for fetching Twitter username
const profileQuery = `
    query User($id: ID!, $cacheId: ID) {
        public(cacheId: $cacheId) {
            user(id: $id) {
                username
                twitterUsername
            }
        }
    }
`;

// Fonction pour récupérer le twitterUsername via une requête GraphQL directe
async function getTwitterUsername(username) {
  const graphqlEndpoint = GQL_ENDPOINT;
  let twitterUsername = null;
  let retries = 3;
  let delayMs = 1000;

  while (retries > 0 && !twitterUsername) {
    try {
      await rateGate(); // espacement global anti-429
      const response = await axios.post(graphqlEndpoint, {
        query: profileQuery,
        variables: {
          id: username,
          cacheId: `getUserQuery-Profile-${username}`
        }
      }, {
        timeout: 10000,
        headers: HTTP_HEADERS
      });

      const result = response.data;
      if (result.errors) {
        throw new Error(`GraphQL Error: ${result.errors.map(e => e.message).join(', ')}`);
      }

      const userData = result.data?.public?.user;
      if (userData?.twitterUsername) {
        twitterUsername = userData.twitterUsername.replace(/^@/, '');
      }

      retries = 0;
    } catch (error) {
      retries--;
      if (retries > 0) {
        await delay(delayMs);
        delayMs *= 2;
      }
    }
  }

  return twitterUsername ? `https://x.com/${twitterUsername}` : '';
}

// Fonction pour écrire le fichier HTML
function writeCryptonautsHTML(collectionsData, globalOwnerNFTs, ownersData) {
  // Prepare collectionsData, including all collections from the collections array
  const allCollectionsData = collections.map(collection => {
    const scrapedData = collectionsData.find(data => data.collectionId === collection.id) || {
      collectionName: collection.name,
      totalSupply: 0,
      owners: 0,
      ownerNFTs: {}
    };
    return {
      id: `collection-${collections.indexOf(collection)}`,
      title: collection.name,
      image: collection.image,
      alt: `${collection.name} COLLECTION ICON`,
      ownersCount: scrapedData.owners,
      // url reconstruite côté client, rank recalculé côté client, twitter omis si vide → JSON plus léger
      owners: Object.entries(scrapedData.ownerNFTs).map(([name, count]) => {
        const owner = { name, count };
        const tw = ownersData[name]?.twitter;
        if (tw) owner.twitter = tw;
        return owner;
      })
    };
  });

  // Prepare globalOwnersData (sans url ni rank : reconstruits/recalculés côté client)
  const globalOwnersData = assignRanks(Object.entries(globalOwnerNFTs)).map(({ name, count }) => {
    const owner = { name, count };
    const tw = ownersData[name]?.twitter;
    if (tw) owner.twitter = tw;
    return owner;
  });

  // Generate HTML content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>CronoBots | Cryptonauts Leaderboards</title>
  <link rel="preload" href="fonts/Geomanist-Bold.woff2" as="font" type="font/woff2" crossorigin="anonymous">
  <link rel="icon" type="image/png" href="assets/icon.png">
  <link rel="preconnect" href="https://media.nft.crypto.com" crossorigin>
  <meta name="description" content="Classements en temps réel des holders Cryptonauts (collection NFT crypto.com) : collections, leaderboard global et liens X.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Cryptonauts Leaderboards">
  <meta property="og:description" content="Classements des holders Cryptonauts : collections, leaderboard global et liens X.">
  <meta property="og:image" content="https://cronobots.github.io/CRYPTONAUTS/assets/Header.png">
  <meta property="og:url" content="https://cronobots.github.io/CRYPTONAUTS/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Cryptonauts Leaderboards">
  <meta name="twitter:description" content="Classements des holders Cryptonauts : collections, leaderboard global et liens X.">
  <meta name="twitter:image" content="https://cronobots.github.io/CRYPTONAUTS/assets/Header.png">
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#03040a">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="CRYPTONAUTS">
  <style>
    :root {
      --primary-color: #66bfff;
      --accent: #ff6a1a;
      --background-dark: #000;
      --text-dark: #fff;
      --muted: rgba(233, 240, 255, 0.62);
      --hairline: rgba(150, 190, 240, 0.14);
      --collection-bg: #1a1a1a;
      --shadow: 0 2px 4px rgba(255,255,255,0.1);
      --font-display: 'Geomanist-Bold', system-ui, sans-serif;
      --font-body: 'Geomanist-Bold', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }

    @font-face {
      font-family: 'Geomanist-Bold';
      src: url('fonts/Geomanist-Bold.woff2') format('woff2'),
           url('fonts/Geomanist-Bold.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

body {
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.65;
  letter-spacing: 0.005em;
  margin: 0;
  color: var(--text-dark);
  background-color: #03040a;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Police d'affichage réservée aux titres et aux données (contraste éditorial) */
h1, h2, h3,
.hero-title, .section-title, .navbar .brand,
.btn, .stat-number, .stat-chip .v, .cm-stat .v,
.rank, .count-number, .lb-count .n,
.collection-body h2, .cm-title {
  font-family: var(--font-display);
}

/* ── Décor spatial : nébuleuse + champ d'étoiles, 100% CSS (aucune requête externe) ── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(78,46,138,0.38), transparent 55%),
    radial-gradient(ellipse at 100% 100%, rgba(22,74,148,0.28), transparent 50%),
    radial-gradient(ellipse at 0% 85%, rgba(126,32,98,0.18), transparent 45%),
    #03040a;
}
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    radial-gradient(1.5px 1.5px at 25px 35px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 130px 90px, rgba(255,255,255,0.85), transparent),
    radial-gradient(1px 1px at 200px 160px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 60px 200px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1.5px 1.5px at 175px 250px, #fff, transparent),
    radial-gradient(1px 1px at 100px 130px, rgba(255,255,255,0.5), transparent);
  background-repeat: repeat;
  background-size: 250px 250px;
  opacity: 0.55;
  background-position: 0 var(--star-shift, 0px);
  animation: twinkle 6s ease-in-out infinite alternate;
}
@keyframes twinkle {
  from { opacity: 0.35; }
  to   { opacity: 0.7; }
}
@media (prefers-reduced-motion: reduce) {
  body::after { animation: none; opacity: 0.5; }
}

    header {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    header img {
      display: block;
      margin: 0 auto;
      width: 100%;
      max-width: 1500px;
      height: auto;
    }

    main {
      padding: 20px;
    }

    .footer-image {
      display: block;
      margin: 20px auto 0;
      width: 100%;
      max-width: 500px;
      height: auto;
    }

    h1 {
      color: var(--text-dark);
      text-transform: uppercase;
      font-weight: 700;
      font-size: 4rem;
      margin-bottom: 10px;
    }

    h2, h3 {
      color: var(--text-dark);
      text-transform: uppercase;
      font-weight: 700;
    }

    h2 {
      font-size: 3.5rem;
    }

    .collection-header h2 {
      margin-top: 0;
      margin-bottom: 0;
    }

    ul {
      list-style-type: none;
      padding-left: 0;
    }

    li {
      margin-bottom: 5px;
    }

    a {
      color: var(--primary-color);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .collection-list, .leaderboard-section {
      margin-bottom: 15px;
    }

    .collection {
      margin-bottom: 20px;
      padding: 15px;
      background-color: rgba(20, 22, 38, 0.82);
      border: 1px solid rgba(102, 191, 255, 0.14);
      border-radius: 15px;
      box-shadow: var(--shadow);
      content-visibility: auto;
      contain-intrinsic-size: auto 260px;
    }

    .collection-header {
      display: flex;
      align-items: center;
      gap: 15px;
      flex-wrap: wrap;
    }

    .collection-image {
      width: 180px;
      height: 180px;
      border-radius: 15px;
      flex-shrink: 0;
    }

    .title-container {
      flex-grow: 1;
      text-align: center;
    }

    .toggle-btn {
      cursor: pointer;
      color: var(--primary-color);
      padding: 5px 10px;
      font-weight: 700;
      text-transform: uppercase;
      transition: transform 0.2s;
    }

    .toggle-btn:hover {
      text-decoration: underline;
    }

    .toggle-btn:active {
      transform: scale(0.95);
    }

    .hidden {
      display: none;
    }

    .hidden h3 {
      width: 180px;
      margin: 0 auto;
      text-align: center;
    }

    .summary {
      background: none;
      padding: 0;
      box-shadow: none;
    }

    #searchInput {
      width: 100%;
      padding: 8px;
      margin-bottom: 10px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 16px;
      box-sizing: border-box;
      background-color: rgba(255, 255, 255, 0.1);
      color: var(--text-dark);
      font-family: 'Geomanist-Bold', sans-serif;
    }

    #searchInput::placeholder {
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
    }

    .leaderboard-section {
      margin-top: 40px;
    }

    .leaderboard-section h1 {
      color: var(--text-dark);
      font-size: 4rem;
      margin-bottom: 10px;
      text-shadow: none;
    }

    #global-owners, #additional-owners {
      padding: 0;
    }

    #global-owners li,
    #additional-owners li,
    .collection ul li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      margin-bottom: 10px;
      border-radius: 8px;
      font-size: 1.2rem;
      text-transform: uppercase;
      font-weight: bold;
      background: none;
      position: relative;
      transition: transform 0.2s;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      opacity: 1;
      will-change: transform;
      z-index: 1;
    }

    #global-owners li::before,
    #additional-owners li::before,
    .collection ul li::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.2);
      opacity: 0.7;
      border-radius: 8px;
      z-index: -1;
      transform: translateZ(0);
    }

    #global-owners li:hover,
    #additional-owners li:hover,
    .collection ul li:hover {
      transform: scale(1.02);
    }

    #global-owners li.rank-1,
    #additional-owners li.rank-1,
    .collection ul li.collection-rank-1,
    #global-owners li.rank-2,
    #additional-owners li.rank-2,
    .collection ul li.collection-rank-2,
    #global-owners li.rank-3,
    #additional-owners li.rank-3,
    .collection ul li.collection-rank-3 {
      font-size: 1.8rem;
      opacity: 1 !important;
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    #global-owners li.rank-1 a:not(.twitter-link),
    #additional-owners li.rank-1 a:not(.twitter-link),
    .collection ul li.collection-rank-1 a:not(.twitter-link),
    #global-owners li.rank-2 a:not(.twitter-link),
    #additional-owners li.rank-2 a:not(.twitter-link),
    .collection ul li.collection-rank-2 a:not(.twitter-link),
    #global-owners li.rank-3 a:not(.twitter-link),
    #additional-owners li.rank-3 a:not(.twitter-link),
    .collection ul li.collection-rank-3 a:not(.twitter-link) {
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    #global-owners li.rank-1::before,
    #additional-owners li.rank-1::before,
    .collection ul li.collection-rank-1::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 215, 0, 0.7);
      opacity: 0.7;
      border-radius: 8px;
      z-index: -1;
      transform: translateZ(0);
    }

    #global-owners li.rank-2::before,
    #additional-owners li.rank-2::before,
    .collection ul li.collection-rank-2::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(192, 192, 192, 0.7);
      opacity: 0.7;
      border-radius: 8px;
      z-index: -1;
      transform: translateZ(0);
    }

    #global-owners li.rank-3::before,
    #additional-owners li.rank-3::before,
    .collection ul li.collection-rank-3::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(205, 127, 50, 0.7);
      opacity: 0.7;
      border-radius: 8px;
      z-index: -1;
      transform: translateZ(0);
    }

    .twitter-link {
      font-size: 1.1rem;
      margin-left: 0.5rem;
      color: var(--primary-color) !important;
      text-decoration: none;
      opacity: 1 !important;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    .twitter-link:hover {
      text-decoration: underline;
    }

    #global-owners li .rank,
    #additional-owners li .rank,
    .collection ul li .rank {
      font-size: 1.6rem;
    }

    #global-owners li.rank-1 .rank,
    #additional-owners li.rank-1 .rank,
    #global-owners li.rank-2 .rank,
    #additional-owners li.rank-2 .rank,
    #global-owners li.rank-3 .rank,
    #additional-owners li.rank-3 .rank,
    .collection ul li.collection-rank-1 .rank,
    .collection ul li.collection-rank-2 .rank,
    .collection ul li.collection-rank-3 .rank {
      font-size: 1.8rem;
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    #global-owners li .count-number,
    #additional-owners li .count-number,
    .collection ul li .count-number {
      font-size: 1.8rem;
    }

    #global-owners li.rank-1 .count-number,
    #additional-owners li.rank-1 .count-number,
    .collection ul li.collection-rank-1 .count-number,
    #global-owners li.rank-2 .count-number,
    #additional-owners li.rank-2 .count-number,
    .collection ul li.collection-rank-2 .count-number,
    #global-owners li.rank-3 .count-number,
    #additional-owners li.rank-3 .count-number,
    .collection ul li.collection-rank-3 .count-number {
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    #global-owners li .count-text,
    #additional-owners li .count-text,
    .collection ul li .count-text {
      font-size: 1.1rem;
      margin-left: 0.5rem;
    }

    #global-owners li.rank-1 .count-text,
    #additional-owners li.rank-1 .count-text,
    .collection ul li.collection-rank-1 .count-text,
    #global-owners li.rank-2 .count-text,
    #additional-owners li.rank-2 .count-text,
    .collection ul li.collection-rank-2 .count-text,
    #global-owners li.rank-3 .count-text,
    #additional-owners li.rank-3 .count-text,
    .collection ul li.collection-rank-3 .count-text {
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    #global-owners li .left-container,
    #additional-owners li .left-container,
    .collection ul li .left-container {
      display: flex;
      align-items: center;
      gap: 5px;
      position: relative;
      z-index: 2;
    }

    #global-owners li .count-container,
    #additional-owners li .count-container,
    .collection ul li .count-container {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 2;
    }

    #global-owners li a,
    #additional-owners li a,
    .collection ul li a {
      color: inherit;
      font-weight: bold;
    }

    .show-more-btn {
      cursor: pointer;
      color: var(--primary-color);
      padding: 5px 10px;
      font-weight: 700;
      text-transform: uppercase;
      transition: transform 0.2s;
      display: block;
      text-align: center;
      margin-top: 10px;
    }

    .show-more-btn:hover {
      text-decoration: underline;
    }

    .show-more-btn:active {
      transform: scale(0.95);
    }

    footer {
      position: relative;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
      color: #fff;
    }

    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .footer-right {
      text-align: right;
    }

    footer a {
      color: #fff;
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    footer img {
      width: auto;
      height: 30px;
      vertical-align: middle;
    }

    /* ── Accents thème astronaute : glow des titres + halos lumineux du podium ── */
    h1,
    .leaderboard-section h1 {
      text-shadow: 0 0 16px rgba(102, 191, 255, 0.45);
    }
    h2 {
      text-shadow: 0 0 14px rgba(102, 191, 255, 0.35);
    }
    #global-owners li.rank-1,
    #additional-owners li.rank-1,
    .collection ul li.collection-rank-1 {
      box-shadow: 0 0 22px rgba(255, 215, 0, 0.30);
    }
    #global-owners li.rank-2,
    #additional-owners li.rank-2,
    .collection ul li.collection-rank-2 {
      box-shadow: 0 0 22px rgba(192, 192, 192, 0.26);
    }
    #global-owners li.rank-3,
    #additional-owners li.rank-3,
    .collection ul li.collection-rank-3 {
      box-shadow: 0 0 22px rgba(205, 127, 50, 0.26);
    }

    /* ── Intro d'ouverture (splash logo) ── */
    #intro {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: radial-gradient(ellipse at 50% 40%, #0b1030 0%, #03040a 70%);
      animation: introOut 0.6s ease 1.7s forwards;
    }
    #intro img {
      width: min(620px, 90vw);
      height: auto;
      animation: introIn 1.1s ease-out both;
    }
    @keyframes introIn {
      from { opacity: 0; transform: translateY(20px) scale(0.9); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes introOut {
      to { opacity: 0; visibility: hidden; pointer-events: none; }
    }

    /* ── Bouton retour en haut ── */
    #scrollTopBtn {
      position: fixed;
      bottom: 22px;
      right: 22px;
      z-index: 900;
      width: 52px;
      height: 52px;
      padding: 0;
      border: 1px solid rgba(102, 191, 255, 0.4);
      border-radius: 50%;
      background: rgba(20, 22, 38, 0.85);
      color: #66bfff;
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 18px rgba(102, 191, 255, 0.35);
      opacity: 0;
      visibility: hidden;
      transform: translateY(12px);
      transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
    }
    #scrollTopBtn.visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    #scrollTopBtn:hover {
      background: rgba(102, 191, 255, 0.18);
      box-shadow: 0 0 26px rgba(102, 191, 255, 0.55);
    }
    #scrollTopBtn:active {
      transform: scale(0.92);
    }

    @media (prefers-reduced-motion: reduce) {
      #intro { animation: introOut 0.3s ease 0.9s forwards; }
      #intro img { animation: none; }
      #scrollTopBtn { transition: opacity 0.2s ease, visibility 0.2s; }
    }

    @media screen and (max-width: 600px) {
      #scrollTopBtn { width: 46px; height: 46px; bottom: 16px; right: 16px; font-size: 1.3rem; }
    }

    @media screen and (max-width: 600px) {
      h1 {
        font-size: 2rem;
        margin-bottom: 8px;
      }
      h2 {
        font-size: 1.5rem;
      }
      .collection-header h2 {
        font-size: 1.5rem;
        margin-top: 0;
        margin-bottom: 0;
      }
      .collection-header {
        flex-direction: column;
        align-items: center;
      }
      .collection-image {
        width: 180px;
        height: 180px;
      }
      .toggle-btn, .show-more-btn {
        font-size: 14px;
      }
      .leaderboard-section h1 {
        font-size: 2rem;
      }
      #global-owners li,
      #additional-owners li,
      .collection ul li {
        font-size: 0.9rem;
        padding: 8px 8px;
      }
      #global-owners li.rank-1,
      #additional-owners li.rank-1,
      .collection ul li.collection-rank-1,
      #global-owners li.rank-2,
      #additional-owners li.rank-2,
      .collection ul li.collection-rank-2,
      #global-owners li.rank-3,
      #additional-owners li.rank-3,
      .collection ul li.collection-rank-3 {
        font-size: 1rem;
        color: #fff;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
      }
      #global-owners li.rank-1 a:not(.twitter-link),
      #additional-owners li.rank-1 a:not(.twitter-link),
      .collection ul li.collection-rank-1 a:not(.twitter-link),
      #global-owners li.rank-2 a:not(.twitter-link),
      #additional-owners li.rank-2 a:not(.twitter-link),
      .collection ul li.collection-rank-2 a:not(.twitter-link),
      #global-owners li.rank-3 a:not(.twitter-link),
      #additional-owners li.rank-3 a:not(.twitter-link),
      .collection ul li.collection-rank-3 a:not(.twitter-link) {
        color: #fff;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
      }
      #global-owners li .rank,
      #additional-owners li .rank,
      .collection ul li .rank {
        font-size: 0.9rem;
      }
      #global-owners li.rank-1 .rank,
      #additional-owners li.rank-1 .rank,
      #global-owners li.rank-2 .rank,
      #additional-owners li.rank-2 .rank,
      #global-owners li.rank-3 .rank,
      #additional-owners li.rank-3 .rank,
      .collection ul li.collection-rank-1 .rank,
      .collection ul li.collection-rank-2 .rank,
      .collection ul li.collection-rank-3 .rank {
        font-size: 0.9rem;
        color: #fff;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
      }
      #global-owners li .count-number,
      #additional-owners li .count-number,
      .collection ul li .count-number {
        font-size: 0.9rem;
      }
      #global-owners li.rank-1 .count-number,
      #additional-owners li.rank-1 .count-number,
      .collection ul li.collection-rank-1 .count-number,
      #global-owners li.rank-2 .count-number,
      #additional-owners li.rank-2 .count-number,
      .collection ul li.collection-rank-2 .count-number,
      #global-owners li.rank-3 .count-number,
      #additional-owners li.rank-3 .count-number,
      .collection ul li.collection-rank-3 .count-number {
        color: #fff;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
      }
      #global-owners li .count-text,
      #additional-owners li .count-text,
      .collection ul li .count-text {
        font-size: 0.55rem;
        margin-left: 0.1rem;
      }
      #global-owners li.rank-1 .count-text,
      #additional-owners li.rank-1 .count-text,
      .collection ul li.collection-rank-1 .count-text,
      #global-owners li.rank-2 .count-text,
      #additional-owners li.rank-2 .count-text,
      .collection ul li.collection-rank-2 .count-text,
      #global-owners li.rank-3 .count-text,
      #additional-owners li.rank-3 .count-text,
      .collection ul li.collection-rank-3 .count-text {
        color: #fff;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
      }
      .twitter-link {
        font-size: 0.5rem;
        margin-left: 0.05rem;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
      }
      footer {
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .footer-left, .footer-right {
        text-align: center;
      }
      footer img {
        height: 24px;
      }
    }

    @media screen and (min-width: 601px) {
      #searchInput {
        width: 100%;
        max-width: 100%;
      }
    }
    /* ── Bandeau de statistiques ── */
    .stats-band {
      display: flex;
      align-items: stretch;
      max-width: 560px;
      margin: 4px auto 26px;
      border-radius: 15px;
      background-color: rgba(20, 22, 38, 0.82);
      border: 1px solid rgba(102, 191, 255, 0.18);
      box-shadow: 0 0 18px rgba(102, 191, 255, 0.08);
      overflow: hidden;
    }
    .stat-card {
      flex: 1 1 0;
      min-width: 0;
      text-align: center;
      padding: 16px 8px;
      border-left: 1px solid rgba(102, 191, 255, 0.14);
    }
    .stat-card:first-child {
      border-left: none;
    }
    .stat-number {
      font-size: 2.4rem;
      line-height: 1;
      color: var(--primary-color);
      text-shadow: 0 0 16px rgba(102, 191, 255, 0.45);
    }
    .stat-label {
      margin-top: 8px;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.75);
    }

    /* ── Focus clavier visible ── */
    .toggle-btn:focus-visible,
    .show-more-btn:focus-visible,
    #scrollTopBtn:focus-visible,
    #searchInput:focus-visible {
      outline: 2px solid rgba(102, 191, 255, 0.7);
      outline-offset: 2px;
    }

    @media screen and (max-width: 600px) {
      .stat-number { font-size: 1.6rem; }
      .stat-label { font-size: 0.62rem; letter-spacing: 0.04em; }
    }
    /* ── PWA : bouton d'installation + fenêtre d'explication ── */
    .install-btn {
      padding: 12px 18px;
      border: 1px solid rgba(102, 191, 255, 0.45);
      border-radius: 30px;
      background: rgba(20, 22, 38, 0.9);
      color: var(--primary-color);
      font-family: 'Geomanist-Bold', sans-serif;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
      box-shadow: 0 0 18px rgba(102, 191, 255, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .install-btn[hidden] { display: none; }
    .install-btn:hover { box-shadow: 0 0 26px rgba(102, 191, 255, 0.55); }
    .install-btn:active { transform: scale(0.96); }

    .modal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(3, 4, 10, 0.82);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }
    .modal[hidden] { display: none; }
    .modal-box {
      position: relative;
      width: 100%;
      max-width: 460px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 26px 24px;
      border-radius: 18px;
      background: rgba(20, 22, 38, 0.97);
      border: 1px solid rgba(102, 191, 255, 0.25);
      box-shadow: 0 0 40px rgba(102, 191, 255, 0.15);
    }
    .modal-box h2 { font-size: 1.5rem; margin: 0 0 10px; }
    .modal-box h3 { font-size: 1rem; color: var(--primary-color); margin: 18px 0 6px; }
    .modal-box p { font-size: 0.95rem; color: rgba(255, 255, 255, 0.8); margin: 0 0 10px; text-transform: none; }
    .modal-box ol { padding-left: 20px; margin: 0; }
    .modal-box li { font-size: 0.92rem; margin-bottom: 8px; color: rgba(255, 255, 255, 0.85); text-transform: none; }
    .install-now {
      display: inline-block;
      margin: 4px 0 6px;
      padding: 12px 20px;
      border: none;
      border-radius: 30px;
      background: var(--primary-color);
      color: #03040a;
      font-family: 'Geomanist-Bold', sans-serif;
      font-size: 1rem;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .install-now[hidden] { display: none; }
    .install-now:active { transform: scale(0.96); }
    .modal-close {
      position: absolute;
      z-index: 5;
      top: 10px;
      right: 12px;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
    }
    .modal-close:hover { background: rgba(255, 255, 255, 0.16); }

    @media screen and (max-width: 600px) {
      .install-btn { font-size: 0.82rem; padding: 10px 16px; }
      .modal-box h2 { font-size: 1.3rem; }
      .modal-close { width: 42px; height: 42px; top: 8px; right: 8px; font-size: 1.7rem; }
    }

    /* ════════ PRÉSENTATION PRO : classements & collections ════════ */

    /* Largeur de lecture confortable sur grand écran */
    main {
      max-width: 1080px;
      margin: 0 auto;
    }

    .collection-list > h1,
    .leaderboard-section h1 {
      letter-spacing: 0.06em;
    }

    /* ── Lignes de classement : base raffinée ── */
    #global-owners li,
    #additional-owners li,
    .collection ul li {
      gap: 12px;
      border: 1px solid rgba(102, 191, 255, 0.10);
      border-left: 3px solid rgba(102, 191, 255, 0.35);
    }
    #global-owners li::before,
    #additional-owners li::before,
    .collection ul li::before {
      background: linear-gradient(90deg, rgba(102, 191, 255, 0.10), rgba(102, 191, 255, 0.02));
      opacity: 1;
    }

    /* Pastille de rang circulaire */
    #global-owners li .rank,
    #additional-owners li .rank,
    .collection ul li .rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.3rem;
      height: 2.3rem;
      padding: 0 0.45rem;
      border-radius: 999px;
      background: rgba(102, 191, 255, 0.14);
      border: 1px solid rgba(102, 191, 255, 0.30);
      color: #cfe9ff;
      font-size: 1.05rem;
      line-height: 1;
      box-shadow: inset 0 0 10px rgba(102, 191, 255, 0.10);
      flex-shrink: 0;
    }

    /* Médaille top 3 */
    .medal {
      font-size: 1.5rem;
      line-height: 1;
      flex-shrink: 0;
      filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.45));
    }

    /* Top 3 : pastilles colorées */
    #global-owners li.rank-1 .rank,
    #additional-owners li.rank-1 .rank,
    .collection ul li.collection-rank-1 .rank {
      background: linear-gradient(135deg, #ffe680, #d4a017);
      border-color: rgba(255, 215, 0, 0.7);
      color: #2a1d00;
      text-shadow: none;
    }
    #global-owners li.rank-2 .rank,
    #additional-owners li.rank-2 .rank,
    .collection ul li.collection-rank-2 .rank {
      background: linear-gradient(135deg, #f5f5f5, #b9b9b9);
      border-color: rgba(220, 220, 220, 0.7);
      color: #1d1d1d;
      text-shadow: none;
    }
    #global-owners li.rank-3 .rank,
    #additional-owners li.rank-3 .rank,
    .collection ul li.collection-rank-3 .rank {
      background: linear-gradient(135deg, #f0b27a, #cd7f32);
      border-color: rgba(205, 127, 50, 0.7);
      color: #2a1400;
      text-shadow: none;
    }

    /* Top 3 : fonds dégradés + bord d'accent coloré */
    #global-owners li.rank-1::before,
    #additional-owners li.rank-1::before,
    .collection ul li.collection-rank-1::before {
      background: linear-gradient(90deg, rgba(255, 215, 0, 0.24), rgba(255, 215, 0, 0.05));
      opacity: 1;
    }
    #global-owners li.rank-2::before,
    #additional-owners li.rank-2::before,
    .collection ul li.collection-rank-2::before {
      background: linear-gradient(90deg, rgba(210, 210, 210, 0.24), rgba(210, 210, 210, 0.05));
      opacity: 1;
    }
    #global-owners li.rank-3::before,
    #additional-owners li.rank-3::before,
    .collection ul li.collection-rank-3::before {
      background: linear-gradient(90deg, rgba(205, 127, 50, 0.24), rgba(205, 127, 50, 0.05));
      opacity: 1;
    }
    #global-owners li.rank-1,
    #additional-owners li.rank-1,
    .collection ul li.collection-rank-1 { border-left-color: #ffd700; }
    #global-owners li.rank-2,
    #additional-owners li.rank-2,
    .collection ul li.collection-rank-2 { border-left-color: #c0c0c0; }
    #global-owners li.rank-3,
    #additional-owners li.rank-3,
    .collection ul li.collection-rank-3 { border-left-color: #cd7f32; }

    /* Badge compteur (pilule) */
    #global-owners li .count-container,
    #additional-owners li .count-container,
    .collection ul li .count-container {
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(102, 191, 255, 0.12);
      border: 1px solid rgba(102, 191, 255, 0.22);
      flex-shrink: 0;
    }
    #global-owners li .count-text,
    #additional-owners li .count-text,
    .collection ul li .count-text {
      opacity: 0.7;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      margin-left: 0;
    }

    /* ── Cartes de collection ── */
    .collection {
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .collection:hover {
      transform: translateY(-3px);
      border-color: rgba(102, 191, 255, 0.40);
      box-shadow: 0 8px 30px rgba(102, 191, 255, 0.12);
    }
    .collection-header {
      cursor: pointer;
      padding: 4px;
      border-radius: 12px;
    }
    .collection-image {
      border: 1px solid rgba(102, 191, 255, 0.25);
      box-shadow: 0 0 20px rgba(102, 191, 255, 0.12);
      transition: transform 0.2s ease;
    }
    .collection:hover .collection-image {
      transform: scale(1.03);
    }

    /* Badge holders visible dans l'en-tête */
    .holders-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 10px auto 4px;
      padding: 6px 16px;
      border-radius: 999px;
      background: rgba(102, 191, 255, 0.10);
      border: 1px solid rgba(102, 191, 255, 0.25);
      color: #cfe9ff;
      font-size: 1rem;
      letter-spacing: 0.05em;
      width: -moz-fit-content;
      width: fit-content;
    }
    .holders-badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary-color);
      box-shadow: 0 0 8px var(--primary-color);
    }

    /* Chevron animé du bouton SHOW OWNERS */
    .toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
    }
    .toggle-btn::after {
      content: '▾';
      font-size: 0.9em;
      transition: transform 0.25s ease;
    }
    .toggle-btn[aria-expanded="true"]::after {
      transform: rotate(180deg);
    }

    /* Ajustements mobile (priment car déclarés en dernier) */
    @media screen and (max-width: 600px) {
      #global-owners li .rank,
      #additional-owners li .rank,
      .collection ul li .rank {
        min-width: 1.7rem;
        height: 1.7rem;
        font-size: 0.8rem;
      }
      .medal { font-size: 1.05rem; }
      #global-owners li .count-container,
      #additional-owners li .count-container,
      .collection ul li .count-container {
        padding: 4px 9px;
      }
      #global-owners li .count-text,
      #additional-owners li .count-text,
      .collection ul li .count-text {
        font-size: 0.5rem;
      }
      .holders-badge { font-size: 0.8rem; padding: 5px 12px; }
    }

    /* ════════════ GALERIE DE COLLECTIONS ════════════ */
    .collection-list > h1 { text-align: center; }

    #collections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
      gap: 22px;
      align-items: stretch;
      max-width: 1180px;
      margin: 0 auto;
    }

    .collection {
      margin: 0;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      opacity: 0;
      translate: 0 20px;
      animation: cardIn 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
    }
    @keyframes cardIn { to { opacity: 1; translate: 0 0; } }

    .collection:hover,
    .collection:focus-visible {
      transform: translateY(-6px);
      border-color: rgba(102, 191, 255, 0.45);
      box-shadow: 0 16px 44px rgba(102, 191, 255, 0.20);
      outline: none;
    }

    .collection-header {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      padding: 0;
      cursor: pointer;
    }

    .collection-cover {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      overflow: hidden;
      background: #0b1030;
    }
    .collection-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border: none;
      border-radius: 0;
      box-shadow: none;
      transition: transform 0.45s ease;
    }
    .collection:hover .collection-cover img,
    .collection:focus-visible .collection-cover img { transform: scale(1.07); }
    .collection-cover::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 1;
      background: linear-gradient(to top, rgba(11, 16, 48, 0.85), transparent 55%);
      pointer-events: none;
    }
    .cover-cta {
      position: absolute;
      z-index: 2;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      padding: 7px 16px;
      border-radius: 999px;
      background: rgba(3, 4, 10, 0.6);
      border: 1px solid rgba(102, 191, 255, 0.5);
      color: #fff;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.25s ease, transform 0.25s ease;
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }
    .collection:hover .cover-cta,
    .collection:focus-visible .cover-cta { opacity: 1; transform: translateX(-50%) translateY(0); }

    .collection-body {
      padding: 16px 16px 18px;
      text-align: center;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .collection-body h2 {
      font-size: 1.1rem;
      line-height: 1.2;
      margin: 0 0 4px;
      text-shadow: 0 0 14px rgba(102, 191, 255, 0.3);
    }
    .collection-date {
      display: block;
      color: #cc8834;
      font-size: 0.8rem;
      margin-bottom: 8px;
    }
    .collection-stats {
      display: flex;
      gap: 10px;
      margin-top: auto;
      padding-top: 12px;
    }
    .stat-chip {
      flex: 1;
      min-width: 0;
      background: rgba(102, 191, 255, 0.07);
      border: 1px solid rgba(102, 191, 255, 0.16);
      border-radius: 12px;
      padding: 10px 6px;
    }
    .stat-chip .v {
      display: block;
      font-size: 1.45rem;
      line-height: 1;
      color: var(--primary-color);
      text-shadow: 0 0 14px rgba(102, 191, 255, 0.4);
    }
    .stat-chip .l {
      display: block;
      margin-top: 5px;
      font-size: 0.58rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.65);
    }

    /* Lignes du leaderboard global : anti-débordement */
    #global-owners li .left-container,
    #additional-owners li .left-container {
      min-width: 0;
      flex: 1 1 auto;
    }
    #global-owners li .left-container > a:first-of-type,
    #additional-owners li .left-container > a:first-of-type {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #global-owners li .count-container,
    #additional-owners li .count-container { flex: 0 0 auto; }

    /* ════════════ MODALE DÉTAIL COLLECTION ════════════ */
    #collectionModal .modal-box {
      max-width: 560px;
      padding: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      max-height: 88vh;
      animation: cmIn 0.35s ease;
    }
    #collectionModal .modal-close {
      position: sticky;
      top: 10px;
      align-self: flex-end;
      flex-shrink: 0;
      margin: 10px 10px -34px 0;
      z-index: 6;
      background: rgba(20, 22, 38, 0.92);
    }
    @keyframes cmIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: none; }
    }
    .cm-header {
      position: relative;
      padding: 26px 20px 18px;
      text-align: center;
      border-bottom: 1px solid rgba(102, 191, 255, 0.15);
      background: radial-gradient(ellipse at 50% 0%, rgba(102, 191, 255, 0.12), transparent 70%);
      flex-shrink: 0;
    }
    .cm-header .cm-cover {
      width: 96px;
      height: 96px;
      border-radius: 18px;
      object-fit: cover;
      border: 1px solid rgba(102, 191, 255, 0.3);
      box-shadow: 0 0 24px rgba(102, 191, 255, 0.25);
    }
    .cm-header .cm-title {
      font-size: 1.25rem;
      margin: 12px 0 14px;
    }
    .cm-stats {
      display: flex;
      justify-content: center;
      gap: 14px;
    }
    .cm-stat {
      min-width: 92px;
      padding: 8px 14px;
      border-radius: 12px;
      background: rgba(102, 191, 255, 0.08);
      border: 1px solid rgba(102, 191, 255, 0.18);
    }
    .cm-stat .v { display: block; font-size: 1.5rem; line-height: 1; color: var(--primary-color); }
    .cm-stat .l { display: block; margin-top: 4px; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255, 255, 255, 0.65); }

    .cm-list {
      list-style: none;
      margin: 0;
      padding: 14px 16px 18px;
      overflow: visible;
    }
    .cm-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 11px 12px;
      margin-bottom: 9px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(102, 191, 255, 0.10);
      border-left: 3px solid rgba(102, 191, 255, 0.35);
      text-transform: uppercase;
      font-weight: bold;
      font-size: 0.95rem;
    }
    .cm-list li .lb-left {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .cm-list li .lb-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--primary-color);
    }
    .cm-list li .rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2rem;
      height: 2rem;
      padding: 0 0.4rem;
      border-radius: 999px;
      background: rgba(102, 191, 255, 0.14);
      border: 1px solid rgba(102, 191, 255, 0.30);
      color: #cfe9ff;
      font-size: 0.95rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .cm-list li .lb-count {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 0 0 auto;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(102, 191, 255, 0.12);
      border: 1px solid rgba(102, 191, 255, 0.22);
    }
    .cm-list li .lb-count .n { font-size: 1.05rem; }
    .cm-list li .lb-count .t { font-size: 0.55rem; opacity: 0.6; letter-spacing: 0.04em; }

    .cm-list li.rank-1 { border-left-color: #ffd700; background: linear-gradient(90deg, rgba(255, 215, 0, 0.16), rgba(255, 255, 255, 0.03)); }
    .cm-list li.rank-2 { border-left-color: #c0c0c0; background: linear-gradient(90deg, rgba(210, 210, 210, 0.16), rgba(255, 255, 255, 0.03)); }
    .cm-list li.rank-3 { border-left-color: #cd7f32; background: linear-gradient(90deg, rgba(205, 127, 50, 0.16), rgba(255, 255, 255, 0.03)); }
    .cm-list li.rank-1 .rank { background: linear-gradient(135deg, #ffe680, #d4a017); border-color: rgba(255, 215, 0, 0.7); color: #2a1d00; }
    .cm-list li.rank-2 .rank { background: linear-gradient(135deg, #f5f5f5, #b9b9b9); border-color: rgba(220, 220, 220, 0.7); color: #1d1d1d; }
    .cm-list li.rank-3 .rank { background: linear-gradient(135deg, #f0b27a, #cd7f32); border-color: rgba(205, 127, 50, 0.7); color: #2a1400; }

    @media (prefers-reduced-motion: reduce) {
      .collection { animation: none; opacity: 1; transform: none; translate: none; }
      #collectionModal .modal-box { animation: none; }
    }

    @media screen and (max-width: 600px) {
      /* Galerie mobile : 1 collection par ligne, carte horizontale (image à gauche, infos à droite) */
      #collections-grid { grid-template-columns: 1fr; gap: 13px; }
      .collection-header { flex-direction: row; align-items: stretch; gap: 0; }
      .collection-cover { width: 122px; flex-shrink: 0; aspect-ratio: auto; align-self: stretch; }
      .collection-cover::after { display: none; }
      .cover-cta { display: none; }
      .sold-badge { top: 8px; left: 8px; font-size: 0.5rem; padding: 4px 8px; }
      .collection-body { text-align: left; padding: 13px 15px; display: flex; flex-direction: column; justify-content: center; gap: 5px; min-width: 0; }
      .collection-body h2 { font-size: 1.04rem; margin: 0 0 1px; }
      .collection-date { margin: 0; font-size: 0.72rem; }
      .collection-stats { margin-top: 6px; padding-top: 0; gap: 8px; }
      .stat-chip { padding: 7px 6px; }
      .stat-chip .v { font-size: 1.1rem; }
      .stat-chip .l { font-size: 0.5rem; }
      .cm-header .cm-cover { width: 74px; height: 74px; }
      .cm-header .cm-title { font-size: 1.05rem; }
      #global-owners li .count-text,
      #additional-owners li .count-text { display: none; }
      .cm-list li .lb-count .t { display: none; }
    }
    /* ════════════════════ SHELL SITE WEB (hero, nav, sections) ════════════════════ */
    html { scroll-behavior: smooth; scroll-padding-top: 84px; }

    /* ── Barre supérieure : bandeau LIVE défilant + navigation sticky ── */
    .marquee {
      overflow: hidden;
      white-space: nowrap;
      border-bottom: 1px solid rgba(102, 191, 255, 0.14);
      background: rgba(3, 4, 10, 0.6);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
    }
    .marquee-track {
      display: inline-flex;
      gap: 0;
      padding: 7px 0;
      animation: marquee 28s linear infinite;
    }
    .marquee-track span {
      padding: 0 22px;
      font-size: 0.74rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(207, 233, 255, 0.85);
    }
    .marquee-track span b { color: var(--primary-color); }
    @keyframes marquee { to { transform: translateX(-50%); } }

    .navbar {
      position: sticky;
      top: 0;
      z-index: 800;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 26px;
      border-bottom: 1px solid rgba(102, 191, 255, 0.10);
      background: rgba(3, 4, 10, 0.35);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      transition: background 0.3s ease, border-color 0.3s ease, padding 0.3s ease;
    }
    .navbar.scrolled {
      background: rgba(3, 4, 10, 0.85);
      border-color: rgba(102, 191, 255, 0.22);
      padding: 10px 26px;
    }
    .navbar .brand {
      font-size: 1.15rem;
      letter-spacing: 0.14em;
      color: #fff;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(102, 191, 255, 0.5);
    }
    .navbar .brand:hover { text-decoration: none; }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .nav-links a {
      font-size: 0.82rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.78);
      position: relative;
    }
    .nav-links a::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: -5px;
      width: 0;
      height: 1.5px;
      background: var(--primary-color);
      box-shadow: 0 0 8px var(--primary-color);
      transition: width 0.25s ease;
    }
    .nav-links a:hover { color: #fff; text-decoration: none; }
    .nav-links a:hover::after { width: 100%; }
    .live-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 13px;
      border-radius: 999px;
      border: 1px solid rgba(102, 191, 255, 0.3);
      background: rgba(102, 191, 255, 0.08);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      color: #cfe9ff;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #57e389;
      box-shadow: 0 0 8px #57e389;
      animation: livePulse 1.8s ease-in-out infinite;
    }
    @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }

    /* ── HERO cinématique ── */
    .hero {
      position: relative;
      min-height: calc(100vh - 84px);
      display: flex;
      align-items: center;
      overflow: hidden;
      padding: 40px 26px 60px;
      box-sizing: border-box;
    }
    .hero-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 72% 45%, rgba(102, 191, 255, 0.22), transparent 45%),
        radial-gradient(circle at 30% 70%, rgba(126, 32, 98, 0.16), transparent 50%);
    }
    .hero-inner {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      align-items: center;
      gap: 30px;
    }
    .hero-copy { animation: heroUp 0.9s ease both; }
    .eyebrow {
      display: inline-block;
      margin-bottom: 18px;
      padding: 7px 15px;
      border-radius: 999px;
      border: 1px solid rgba(102, 191, 255, 0.3);
      background: rgba(102, 191, 255, 0.07);
      font-size: 0.72rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #cfe9ff;
    }
    .hero-title {
      font-size: clamp(3rem, 9vw, 6.6rem);
      line-height: 0.95;
      margin: 0 0 18px;
      text-transform: uppercase;
      letter-spacing: 0.01em;
      text-shadow: 0 0 40px rgba(102, 191, 255, 0.35);
    }
    .hero-title span {
      background: linear-gradient(120deg, #66bfff, #a9dbff);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;
    }
    .hero-sub {
      max-width: 30em;
      font-size: 1.02rem;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.72);
      text-transform: none;
      margin: 0 0 26px;
    }
    .hero-metrics { margin: 0 0 28px; }
    .hero-metrics .stats-band { margin: 0; max-width: 480px; }
    .hero-cta { display: flex; flex-wrap: wrap; gap: 14px; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 14px 26px;
      border-radius: 999px;
      font-size: 0.86rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    .btn:hover { text-decoration: none; transform: translateY(-2px); }
    .btn:active { transform: scale(0.97); }
    .btn-primary {
      background: linear-gradient(120deg, #66bfff, #3d9bff);
      color: #03040a;
      box-shadow: 0 0 26px rgba(102, 191, 255, 0.4);
    }
    .btn-primary:hover { box-shadow: 0 0 38px rgba(102, 191, 255, 0.65); }
    .btn-ghost {
      border: 1px solid rgba(102, 191, 255, 0.4);
      background: rgba(102, 191, 255, 0.06);
      color: #cfe9ff;
    }
    .btn-ghost:hover { background: rgba(102, 191, 255, 0.16); }

    .hero-visual {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: heroUp 0.9s ease 0.15s both;
    }
    .hero-astronaut {
      width: min(420px, 80%);
      height: auto;
      border-radius: 26px;
      border: 1px solid rgba(102, 191, 255, 0.25);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(102, 191, 255, 0.18);
      animation: float 7s ease-in-out infinite;
    }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
    @keyframes heroUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }

    .scroll-cue {
      position: absolute;
      z-index: 1;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 0.66rem;
      letter-spacing: 0.22em;
      color: rgba(255, 255, 255, 0.55);
    }
    .scroll-cue:hover { color: #fff; text-decoration: none; }
    .scroll-cue .chev { font-size: 1.2rem; animation: bob 1.8s ease-in-out infinite; }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }

    /* ── En-têtes de section ── */
    .section { padding-top: 30px; }
    .section-head {
      text-align: center;
      max-width: 760px;
      margin: 0 auto 32px;
    }
    .section-head .eyebrow { margin-bottom: 14px; }
    .section-title {
      font-size: clamp(2rem, 5vw, 3.4rem);
      margin: 0 0 12px;
      text-transform: uppercase;
      text-shadow: 0 0 24px rgba(102, 191, 255, 0.3);
    }
    .section-sub {
      font-size: 1rem;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.65);
      text-transform: none;
      margin: 0;
    }

    /* ── Révélations au défilement ── */
    .reveal {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.7, 0.3, 1);
    }
    .reveal.in-view { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .reveal { opacity: 1; transform: none; transition: none; }
      .hero-copy, .hero-visual { animation: none; }
      .hero-astronaut { animation: none; }
      .scroll-cue .chev, .live-dot { animation: none; }
      .marquee-track { animation: none; }
    }

    @media screen and (max-width: 860px) {
      .hero-inner { grid-template-columns: 1fr; text-align: center; gap: 18px; }
      .hero-copy { order: 2; }
      .hero-visual { order: 1; animation-delay: 0s; }
      .hero-sub { margin-left: auto; margin-right: auto; }
      .hero-cta { justify-content: center; }
      .hero-metrics .stats-band { margin: 0 auto; }
    }
    @media screen and (max-width: 600px) {
      .navbar { padding: 11px 16px; }
      .nav-links { gap: 16px; flex: 1; min-width: 0; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      .nav-links::-webkit-scrollbar { display: none; }
      .nav-links a { font-size: 0.72rem; letter-spacing: 0.02em; white-space: nowrap; }
      .nav-x { display: none; }
      .navbar .brand { font-size: 0.95rem; flex-shrink: 0; }
      .hero { min-height: auto; padding: 30px 16px 44px; }
      .hero-astronaut { width: min(280px, 72%); }
      .btn { padding: 12px 20px; font-size: 0.78rem; }
      .marquee-track span { font-size: 0.66rem; padding: 0 16px; }
      .live-pill { display: none; }
    }
    /* ════════════════════ FINITION PREMIUM ════════════════════ */

    /* Grain filmique très léger sur l'ensemble */
    .grain {
      position: fixed;
      inset: 0;
      z-index: 9997;
      pointer-events: none;
      opacity: 0.04;
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    /* Eyebrow éditorial : libellé fin précédé d'un trait lumineux */
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 20px;
      padding: 0;
      border: none;
      background: none;
      border-radius: 0;
      font-family: var(--font-body);
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .eyebrow::before {
      content: '';
      width: 28px;
      height: 1px;
      background: linear-gradient(90deg, var(--primary-color), transparent);
    }
    .section-head .eyebrow { justify-content: center; }
    .section-head .eyebrow::before { background: linear-gradient(90deg, transparent, var(--primary-color)); }
    .section-head .eyebrow::after {
      content: '';
      width: 28px;
      height: 1px;
      background: linear-gradient(90deg, var(--primary-color), transparent);
    }

    /* Hero : titre et accroche affinés */
    .hero-title {
      font-size: clamp(2.9rem, 8.5vw, 6.2rem);
      letter-spacing: -0.015em;
      text-shadow: 0 0 34px rgba(102, 191, 255, 0.16);
      margin-bottom: 20px;
    }
    .hero-title .tm {
      font-size: 0.26em;
      vertical-align: top;
      margin-left: 0.12em;
      color: var(--primary-color);
      -webkit-text-fill-color: var(--primary-color);
      letter-spacing: 0;
    }
    .hero-tagline {
      font-family: var(--font-display);
      font-size: clamp(1.1rem, 2.4vw, 1.55rem);
      line-height: 1.28;
      letter-spacing: 0.005em;
      color: #eaf2ff;
      text-transform: none;
      margin: 0 0 16px;
    }
    .hero-sub {
      color: var(--muted);
      font-size: 1rem;
    }

    /* Cadre « galerie » autour de l'astronaute */
    .hero-frame { position: relative; padding: 16px; }
    .hero-frame::before,
    .hero-frame::after {
      content: '';
      position: absolute;
      width: 26px;
      height: 26px;
      border: 1px solid rgba(102, 191, 255, 0.45);
      pointer-events: none;
    }
    .hero-frame::before { top: 0; left: 0; border-right: none; border-bottom: none; }
    .hero-frame::after { bottom: 0; right: 0; border-left: none; border-top: none; }

    /* Boutons : icône alignée, retenue */
    .btn { font-size: 0.82rem; letter-spacing: 0.04em; text-transform: none; }
    .btn .ico { flex-shrink: 0; }
    .btn-primary { box-shadow: 0 10px 30px rgba(102, 191, 255, 0.22); }
    .btn-primary:hover { box-shadow: 0 14px 38px rgba(102, 191, 255, 0.42); }

    /* Bandeau LIVE : séparateur losange discret */
    .marquee { border-bottom: 1px solid var(--hairline); }
    .marquee-track span { font-weight: 500; color: rgba(214, 232, 255, 0.78); text-transform: none; letter-spacing: 0.14em; }
    .sep {
      display: inline-block;
      width: 4px;
      height: 4px;
      margin: 0 18px;
      transform: rotate(45deg);
      background: rgba(102, 191, 255, 0.55);
      vertical-align: middle;
    }

    /* Nav : icône X sans soulignement, libellés affinés */
    .navbar { border-bottom: 1px solid var(--hairline); }
    .nav-links a { font-weight: 500; text-transform: none; letter-spacing: 0.04em; color: rgba(233, 240, 255, 0.72); }
    .nav-x { display: inline-flex; align-items: center; color: rgba(233, 240, 255, 0.72); }
    .nav-x:hover { color: #fff; }
    .nav-x::after { display: none; }
    .live-pill { font-family: var(--font-body); font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; }

    /* Métriques du hero : rangée à filets, sans cadre lourd */
    .hero-metrics .stats-band {
      background: none;
      border: none;
      box-shadow: none;
      border-radius: 0;
      border-top: 1px solid var(--hairline);
      border-bottom: 1px solid var(--hairline);
      padding: 6px 0;
      max-width: 460px;
    }
    .hero-metrics .stat-card { border-left: none; padding: 14px 10px; }
    .hero-metrics .stat-card + .stat-card { border-left: 1px solid var(--hairline); }
    .stat-number { text-shadow: 0 0 18px rgba(102, 191, 255, 0.3); }
    .stat-label { font-family: var(--font-body); font-weight: 500; }

    /* Titres de section : glow retenu */
    .section-title { text-shadow: none; letter-spacing: -0.01em; text-transform: none; }
    .section-sub { color: var(--muted); }
    .collection-body h2 { text-shadow: none; }
    .cm-title { text-shadow: none; }

    /* Champs & libellés en police de corps */
    #searchInput { font-family: var(--font-body); font-weight: 500; }
    .stat-chip .l, .cm-stat .l, .count-text, .lb-count .t { font-family: var(--font-body); font-weight: 500; }

    /* Footer affiné */
    footer {
      border-top: 1px solid var(--hairline);
      margin-top: 46px;
      padding: 24px 26px;
      font-family: var(--font-body);
      font-size: 0.82rem;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    footer p { margin: 0; }
    footer .footer-left a { color: #cfe9ff; }
    .install-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-body);
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0.02em;
      box-shadow: none;
    }
    .install-btn:hover { box-shadow: 0 0 22px rgba(102, 191, 255, 0.4); }

    @media screen and (max-width: 600px) {
      .sep { margin: 0 12px; }
      .hero-frame { padding: 12px; }
    }

    /* ── Intégration : statut, récit de collection, liens communauté ── */
    .sold-badge {
      position: absolute;
      z-index: 2;
      top: 12px;
      left: 12px;
      padding: 5px 11px;
      border-radius: 999px;
      background: rgba(3, 4, 10, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.25);
      -webkit-backdrop-filter: blur(5px);
      backdrop-filter: blur(5px);
      font-family: var(--font-body);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #fff;
    }

    .cm-desc {
      margin: 18px 0 0;
      font-size: 0.9rem;
      line-height: 1.62;
      color: var(--muted);
      text-transform: none;
      text-align: left;
    }
    .cm-desc[hidden] { display: none; }
    .cm-link {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-top: 16px;
      padding: 9px 16px;
      border-radius: 999px;
      border: 1px solid rgba(102, 191, 255, 0.4);
      background: rgba(102, 191, 255, 0.08);
      color: #cfe9ff;
      font-family: var(--font-body);
      font-size: 0.78rem;
      font-weight: 500;
      letter-spacing: 0.03em;
    }
    .cm-link[hidden] { display: none; }
    .cm-link:hover { background: rgba(102, 191, 255, 0.18); text-decoration: none; }

    .artist-links {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(216px, 1fr));
      gap: 16px;
      max-width: 920px;
      margin: 0 auto;
    }
    .link-card {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 20px;
      border-radius: 16px;
      background: rgba(20, 22, 38, 0.55);
      border: 1px solid var(--hairline);
      color: #fff;
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
    }
    .link-card:hover {
      transform: translateY(-4px);
      border-color: rgba(102, 191, 255, 0.4);
      background: rgba(20, 22, 38, 0.82);
      text-decoration: none;
    }
    .lc-head {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-display);
      font-size: 1rem;
      color: #fff;
    }
    .lc-head svg { color: var(--primary-color); flex-shrink: 0; }
    .lc-sub { font-size: 0.8rem; color: var(--muted); letter-spacing: 0.02em; }

    /* Citation de l'artiste */
    .artist-quote {
      max-width: 760px;
      margin: 0 auto 32px;
      padding: 0 20px;
      text-align: center;
    }
    .artist-quote p {
      font-family: var(--font-display);
      font-size: clamp(1.15rem, 2.6vw, 1.7rem);
      line-height: 1.36;
      color: #eaf2ff;
      margin: 0 0 14px;
    }
    .artist-quote cite {
      font-style: normal;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }

    /* Stats marché de la modale + chiffres de la saga */
    .cm-stats { flex-wrap: wrap; }
    .saga-stats {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 14px;
      max-width: 780px;
      margin: 0 auto 32px;
    }
    .saga-stat {
      flex: 1 1 auto;
      min-width: 132px;
      text-align: center;
      padding: 18px 14px;
      border-radius: 14px;
      background: rgba(20, 22, 38, 0.5);
      border: 1px solid var(--hairline);
    }
    .saga-stat .v {
      display: block;
      font-family: var(--font-display);
      font-size: 1.85rem;
      line-height: 1;
      color: var(--primary-color);
      text-shadow: 0 0 18px rgba(102, 191, 255, 0.3);
    }
    .saga-stat .l {
      display: block;
      margin-top: 8px;
      font-size: 0.66rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
    }
    @media screen and (max-width: 600px) {
      .saga-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .saga-stat { min-width: 0; padding: 14px 8px; }
      .saga-stat .v { font-size: 1.4rem; }
      .tab-bar { gap: 6px; }
      .tab-btn { padding: 9px 13px; font-size: 0.72rem; letter-spacing: 0.04em; }
    }

    /* ── Séparation nette des sections ── */
    #stats, #leaderboard, #artist, .leaderboard-section {
      border-top: 1px solid var(--hairline);
      margin-top: 52px;
      padding-top: 56px;
    }

    /* ── Aperçu des NFT dans la modale ── */
    .cm-sec {
      margin: 0;
      padding: 18px 16px 0;
      font-family: var(--font-display);
      font-size: 0.74rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .cm-nfts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 10px;
      padding: 12px 16px 6px;
    }
    .nft {
      display: flex;
      flex-direction: column;
      gap: 5px;
      color: var(--muted);
      font-size: 0.6rem;
    }
    .nft:hover { text-decoration: none; color: #fff; }
    .nft-img {
      display: block;
      aspect-ratio: 1 / 1;
      border-radius: 10px;
      overflow: hidden;
      background: rgba(102, 191, 255, 0.06);
      border: 1px solid var(--hairline);
    }
    .nft-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
    .nft:hover .nft-img img { transform: scale(1.06); }
    .nft-name { text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.02em; }
    .nft.skeleton {
      display: block;
      aspect-ratio: 1 / 1;
      border-radius: 10px;
      background: linear-gradient(100deg, rgba(255, 255, 255, 0.04) 30%, rgba(255, 255, 255, 0.09) 50%, rgba(255, 255, 255, 0.04) 70%);
      background-size: 200% 100%;
      animation: shimmer 1.3s linear infinite;
    }
    @keyframes shimmer { to { background-position: -200% 0; } }
    .cm-empty { padding: 6px 16px 14px; color: var(--muted); font-size: 0.85rem; text-transform: none; }

    /* ── Tableau récapitulatif des collections (section Stats) ── */
    .stats-table {
      max-width: 920px;
      margin: 0 auto;
      border: 1px solid var(--hairline);
      border-radius: 16px;
      overflow: hidden;
      background: rgba(20, 22, 38, 0.4);
    }
    .st-row {
      display: grid;
      grid-template-columns: 2.3fr 1fr 1fr 1fr 1fr;
      align-items: center;
      gap: 10px;
      padding: 13px 18px;
      border-top: 1px solid var(--hairline);
      font-size: 0.92rem;
    }
    .st-row:first-child { border-top: none; }
    .st-head {
      font-family: var(--font-body);
      font-size: 0.64rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      background: rgba(102, 191, 255, 0.05);
    }
    .st-row > span:not(.st-name) { font-family: var(--font-display); text-align: right; color: #eaf2ff; }
    .st-head > span:not(.st-name) { font-family: var(--font-body); color: var(--muted); }
    .st-name {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
      font-family: var(--font-display);
      color: #fff;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .st-name img { width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0; object-fit: cover; border: 1px solid var(--hairline); }

    @media screen and (max-width: 640px) {
      .st-head { display: none; }
      .st-row { grid-template-columns: 1fr 1fr; gap: 7px 12px; padding: 14px; }
      .st-name { grid-column: 1 / -1; margin-bottom: 3px; }
      .st-row > span:not(.st-name) { display: flex; justify-content: space-between; align-items: baseline; text-align: left; font-size: 0.9rem; }
      .st-row > span:not(.st-name)::before {
        content: attr(data-l);
        font-family: var(--font-body);
        color: var(--muted);
        font-size: 0.6rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    }
    /* ── Onglets de la section artiste ── */
    .tabs { max-width: 860px; margin: 0 auto; }
    .tab-bar { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 28px; }
    .tab-btn {
      padding: 10px 22px;
      border-radius: 999px;
      border: 1px solid var(--hairline);
      background: rgba(20, 22, 38, 0.5);
      color: var(--muted);
      font-family: var(--font-display);
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .tab-btn:hover { color: #fff; border-color: rgba(102, 191, 255, 0.4); }
    .tab-btn.is-active {
      color: #03040a;
      background: var(--primary-color);
      border-color: var(--primary-color);
      box-shadow: 0 0 22px rgba(102, 191, 255, 0.4);
    }
    .tab-panel { display: none; }
    .tab-panel.is-active { display: block; animation: tabIn 0.4s ease; }
    @keyframes tabIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .tab-text { max-width: 680px; margin: 0 auto; text-align: center; }
    .tab-text p { color: var(--muted); line-height: 1.75; margin: 0 0 16px; font-size: 1.02rem; text-transform: none; }
    .tab-text em { color: #cfe9ff; font-style: italic; }
    .tab-text strong { color: #fff; }
    .iv {
      margin: 0 0 16px;
      padding: 18px 22px;
      border-left: 2px solid rgba(102, 191, 255, 0.5);
      background: rgba(102, 191, 255, 0.05);
      border-radius: 0 12px 12px 0;
      color: #eaf2ff;
      font-size: 1.05rem;
      line-height: 1.45;
      text-align: left;
      text-transform: none;
    }
    .tab-text .btn { margin-top: 8px; }
    .tab-tagline {
      font-family: var(--font-display);
      font-size: clamp(1.15rem, 3vw, 1.7rem);
      color: #eaf2ff;
      margin: 22px 0 0;
      text-transform: none;
    }
    .tab-panel .artist-links { margin-top: 4px; }
    .links-group { margin-bottom: 24px; }
    .links-group:last-child { margin-bottom: 0; }
    .links-h { font-family: var(--font-body); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); text-align: center; margin: 0 0 12px; }
    @media (prefers-reduced-motion: reduce) { .tab-panel.is-active { animation: none; } }

    /* Stats : nom de collection + année de sortie */
    .st-meta { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
    .st-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st-rel { font-family: var(--font-body); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }
    .st-name { white-space: normal; }

    /* Ambiance cosmique des sections artiste & stats */
    #artist, #stats { position: relative; overflow: hidden; }
    #artist::before, #stats::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background: radial-gradient(ellipse at 50% 0%, rgba(102, 191, 255, 0.10), transparent 62%);
    }
    /* ════════ PAGE DÉTAILLÉE D'UNE COLLECTION ════════ */
    /* Vues séparées : on n'affiche qu'une section à la fois (pilotée par data-view) */
    .hidden-view { display: none !important; }
    .nav-links a.is-active { color: #fff; }
    .nav-links a.is-active::after { width: 100%; }

    .cv-banner {
      position: relative;
      width: 100%;
      height: clamp(230px, 34vw, 380px);
      overflow: hidden;
      background: linear-gradient(135deg, #0b1030, #161526);
    }
    .cv-banner-img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.5s ease; }
    #collectionView.has-banner .cv-banner-img { opacity: 1; }
    .cv-banner-grad {
      position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(to bottom, rgba(3, 4, 10, 0.15), rgba(3, 4, 10, 0.5) 60%, #03040a);
    }
    .cv-back {
      position: absolute; z-index: 4; top: 18px; left: 18px;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 999px;
      border: 1px solid rgba(102, 191, 255, 0.4);
      background: rgba(3, 4, 10, 0.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
      color: #cfe9ff; font-family: var(--font-display);
      font-size: 0.78rem; letter-spacing: 0.04em; cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }
    .cv-back:hover { background: rgba(102, 191, 255, 0.18); }
    .cv-back:active { transform: scale(0.97); }

    .cv-inner { max-width: 1080px; margin: 0 auto; padding: 0 20px 40px; }
    /* Titre centré horizontalement ET verticalement dans la bannière.
       pointer-events:none -> ne bloque pas les clics du bouton retour situé dessous. */
    .cv-title {
      position: absolute; z-index: 2; inset: 0; pointer-events: none;
      display: flex; align-items: center; justify-content: center; text-align: center;
      margin: 0; padding: 46px 26px 26px;
      font-size: clamp(1.7rem, 4.6vw, 3rem); line-height: 1.1;
      text-shadow: 0 3px 26px rgba(0, 0, 0, 0.9);
    }
    /* Logo à cheval : moitié dans la bannière, moitié en dessous, à droite */
    .cv-logo {
      position: absolute; z-index: 3; right: 7%; bottom: 0; transform: translateY(50%);
      width: 128px; height: 128px; border-radius: 20px; object-fit: cover;
      border: 1px solid rgba(102, 191, 255, 0.3);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6), 0 0 40px rgba(102, 191, 255, 0.18);
      background: #0b1030;
    }
    .cv-meta { padding: 22px 184px 0 0; min-height: 66px; }
    .cv-release { display: block; margin-bottom: 8px; font-family: var(--font-body); font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
    .cv-sold {
      display: inline-block; padding: 4px 12px; border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06);
      font-family: var(--font-body); font-size: 0.62rem; font-weight: 600;
      letter-spacing: 0.16em; text-transform: uppercase; color: #fff; margin-bottom: 8px;
    }
    .cv-sold[hidden] { display: none; }
    .cv-desc { color: var(--muted); line-height: 1.65; max-width: 720px; margin: 8px 0 16px; font-size: 0.95rem; }
    .cv-link[hidden] { display: none; }

    .cv-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 44px; }
    .cv-stat { text-align: center; padding: 16px 8px; border-radius: 14px; background: rgba(20, 22, 38, 0.5); border: 1px solid var(--hairline); }
    .cv-stat .v { display: block; font-family: var(--font-display); font-size: 1.5rem; line-height: 1; color: var(--primary-color); text-shadow: 0 0 16px rgba(102, 191, 255, 0.35); }
    .cv-stat .l { display: block; margin-top: 7px; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

    .cv-block { margin-bottom: 44px; }
    .cv-sec-title { font-size: 1.4rem; margin: 0 0 16px; text-transform: none; }
    .cv-count { color: var(--muted); font-size: 0.9rem; font-family: var(--font-body); }
    #cvNfts { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); padding: 0; }
    #cvNfts .nft { font-size: 0.66rem; }
    .cv-more {
      display: block; margin: 24px auto 0; padding: 12px 26px; border-radius: 999px;
      border: 1px solid rgba(102, 191, 255, 0.4); background: rgba(102, 191, 255, 0.08);
      color: #cfe9ff; font-family: var(--font-display); font-size: 0.8rem; letter-spacing: 0.05em;
      text-transform: uppercase; cursor: pointer; transition: background 0.2s ease;
    }
    .cv-more:hover { background: rgba(102, 191, 255, 0.18); }
    .cv-more[hidden] { display: none; }
    .cv-more:disabled { opacity: 0.5; cursor: default; }
    #cvList { padding: 0; }

    @media screen and (max-width: 600px) {
      .cv-title { padding: 34px 14px 16px; }
      .cv-logo { width: 86px; height: 86px; right: 16px; border-radius: 15px; }
      .cv-meta { padding: 56px 0 0; min-height: 0; }
      .cv-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
      #cvNfts { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
    }
    /* ════════ SPOTLIGHT : mur d'œuvres en mouvement ════════ */
    .spot-wall {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 16px;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
      mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
    }
    .spot-row { display: flex; gap: 16px; width: max-content; animation: spotScroll 75s linear infinite; will-change: transform; }
    .spot-rev { animation-direction: reverse; }
    .spot-wall:hover .spot-row { animation-play-state: paused; }
    @keyframes spotScroll { to { transform: translateX(-50%); } }
    .spot-nft {
      width: 150px; height: 150px; flex-shrink: 0; border-radius: 16px; overflow: hidden;
      border: 1px solid var(--hairline); background: rgba(20, 22, 38, 0.5);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    }
    .spot-nft img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .spot-nft:hover {
      transform: translateY(-6px) scale(1.04) rotate(-1.2deg);
      border-color: rgba(102, 191, 255, 0.55);
      box-shadow: 0 16px 38px rgba(102, 191, 255, 0.22);
    }
    .spot-skel { background: linear-gradient(100deg, rgba(255, 255, 255, 0.04) 30%, rgba(255, 255, 255, 0.09) 50%, rgba(255, 255, 255, 0.04) 70%); background-size: 200% 100%; animation: shimmer 1.3s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .spot-row { animation: none; } }
    @media screen and (max-width: 600px) {
      .spot-nft { width: 118px; height: 118px; border-radius: 13px; }
      .spot-wall { gap: 12px; }
      .spot-row { gap: 12px; }
    }
    /* ════════ GALERIE : lignes-bannières (1 collection / ligne) ════════ */
    #collections-grid { display: flex; flex-direction: column; gap: 14px; max-width: 1080px; margin: 0 auto; }
    .col-row {
      position: relative; display: block; height: 132px;
      border-radius: 16px; overflow: hidden; text-decoration: none;
      border: 1px solid rgba(255, 255, 255, 0.07);
      background: linear-gradient(135deg, #0b1030, #161526);
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
      opacity: 0; translate: 0 18px; animation: cardIn 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
    }
    .col-row:hover, .col-row:focus-visible {
      border-color: rgba(102, 191, 255, 0.45);
      box-shadow: 0 14px 34px rgba(102, 191, 255, 0.18);
      outline: none;
    }
    .col-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.5; transition: transform 0.45s ease, opacity 0.3s ease; }
    .col-row:hover .col-bg { transform: scale(1.05); opacity: 0.62; }
    .col-grad { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(3, 4, 10, 0.9) 0%, rgba(3, 4, 10, 0.5) 30%, rgba(3, 4, 10, 0.5) 70%, rgba(3, 4, 10, 0.9) 100%); }
    .col-logo {
      position: absolute; z-index: 2; left: 22px; top: 50%; transform: translateY(-50%);
      width: 94px; height: 94px; border-radius: 15px; object-fit: cover;
      border: 1px solid rgba(102, 191, 255, 0.32); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
    }
    .col-title-wrap {
      position: absolute; z-index: 2; inset: 0; padding: 0 168px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 5px;
    }
    .col-title { margin: 0; font-size: clamp(1.05rem, 2.3vw, 1.55rem); line-height: 1.15; color: #fff; text-shadow: 0 2px 16px rgba(0, 0, 0, 0.85); }
    .col-date { font-size: 0.68rem; letter-spacing: 0.13em; text-transform: uppercase; color: rgba(233, 240, 255, 0.7); }
    .col-stats { position: absolute; z-index: 2; right: 22px; top: 50%; transform: translateY(-50%); display: flex; gap: 14px; }
    .col-stat { text-align: center; }
    .col-stat .cv { display: block; font-family: var(--font-display); font-size: 1.3rem; line-height: 1; color: var(--primary-color); text-shadow: 0 0 14px rgba(102, 191, 255, 0.35); }
    .col-stat .cl { display: block; margin-top: 4px; font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .col-sold {
      position: absolute; z-index: 3; top: 12px; right: 16px;
      padding: 4px 9px; border-radius: 999px; background: rgba(3, 4, 10, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.25); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
      font-family: var(--font-body); font-size: 0.5rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #fff;
    }
    @media (prefers-reduced-motion: reduce) { .col-row { animation: none; opacity: 1; translate: none; } }
    @media screen and (max-width: 600px) {
      .col-row { height: 104px; }
      .col-logo { width: 66px; height: 66px; left: 12px; border-radius: 12px; }
      .col-title-wrap { padding: 0 84px 0 88px; }
      .col-title { font-size: 0.96rem; }
      .col-date { font-size: 0.58rem; }
      .col-stats { right: 12px; gap: 9px; }
      .col-stat .cv { font-size: 1rem; }
      .col-stat .cl { font-size: 0.47rem; }
      .col-sold { top: 8px; right: 10px; font-size: 0.46rem; padding: 3px 7px; }
    }
  </style>
</head>
<body>
  <div id="intro" aria-hidden="true">
    <img src="assets/Footer.png" alt="Cryptonauts">
  </div>

  <div class="grain" aria-hidden="true"></div>

  <nav class="navbar" id="navbar">
    <a href="#home" class="brand">Cryptonauts</a>
    <div class="nav-links">
      <a href="#home" data-nav="home">Home</a>
      <a href="#collections" data-nav="collections">Collections</a>
      <a href="#stats" data-nav="stats">Stats</a>
      <a href="#leaderboard" data-nav="leaderboard">Leaderboard</a>
      <a href="#artist" data-nav="artist">Artist</a>
      <a href="https://x.com/cryptonautscdc" target="_blank" rel="noopener" class="nav-x" aria-label="Cryptonauts on X">
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
    </div>
  </nav>

  <header id="home" class="hero" data-view="home">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="eyebrow">Crypto.com NFT</span>
        <h1 class="hero-title">Cryptonauts<sup class="tm">™</sup></h1>
        <p class="hero-tagline">Eleven collections. One galaxy of holders.</p>
        <p class="hero-sub">A live ranking of every Cryptonauts collection on crypto.com — who holds the most across the galaxy, refreshed every day.</p>
        <div class="hero-metrics" id="heroStats"></div>
        <div class="hero-cta">
          <a href="#collections" class="btn btn-primary">
            <svg class="ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>
            Explore collections
          </a>
          <a href="#leaderboard" class="btn btn-ghost">
            View leaderboard
            <svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-frame">
          <img src="assets/icon-512.png" alt="Quantum Cryptonauts astronaut" class="hero-astronaut" decoding="async">
        </div>
      </div>
    </div>
    <a href="#collections" class="scroll-cue" aria-label="Scroll to collections">
      <span>Scroll</span>
      <svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </header>

  <main>
    <section class="section reveal spot-section" id="spotlight" data-view="home">
      <div class="section-head">
        <span class="eyebrow">Spotlight</span>
        <h2 class="section-title">Straight from the galaxy</h2>
        <p class="section-sub">A living wall of Cryptonauts artworks — tap any to open it on crypto.com.</p>
      </div>
      <div class="spot-wall" id="spotWall" aria-label="Featured Cryptonauts">
        <div class="spot-row" id="spotRowA"></div>
        <div class="spot-row spot-rev" id="spotRowB"></div>
      </div>
    </section>

    <section class="section reveal hidden-view" id="collections" data-view="collections">
      <div class="section-head">
        <span class="eyebrow">The collections</span>
        <h2 class="section-title">Eleven worlds, one crew</h2>
        <p class="section-sub">Each collection is a chapter of the Cryptonauts saga. Open any one to see its holders, ranked.</p>
      </div>
      <div id="collections-grid"></div>
    </section>

    <section class="section reveal hidden-view" id="stats" data-view="stats">
      <div class="section-head">
        <span class="eyebrow">By the numbers</span>
        <h2 class="section-title">The saga in figures</h2>
        <p class="section-sub">Live market data from the crypto.com NFT chain, across all eleven sold-out collections.</p>
      </div>
      <div class="saga-stats">
        <div class="saga-stat"><span class="v">$194K</span><span class="l">Traded volume</span></div>
        <div class="saga-stat"><span class="v">3,914</span><span class="l">Secondary sales</span></div>
        <div class="saga-stat"><span class="v">2,002</span><span class="l">Items minted</span></div>
        <div class="saga-stat"><span class="v">11</span><span class="l">Sold-out drops</span></div>
      </div>
      <div class="stats-table" id="statsTable"></div>
    </section>

    <section class="section reveal hidden-view" id="artist" data-view="artist">
      <div class="section-head">
        <span class="eyebrow">The artist</span>
        <h2 class="section-title">Fran Rodríguez</h2>
        <p class="section-sub">Barcelona-based surreal digital-collage artist. Two decades freelance, with album artwork for Tame Impala, Weezer and Coldplay — and the mind behind the Cryptonauts saga: thirteen curated, fully sold-out drops on crypto.com.</p>
      </div>
      <div class="tabs" id="artistTabs">
        <div class="tab-bar" role="tablist" aria-label="Artist sections">
          <button class="tab-btn is-active" role="tab" aria-selected="true" data-tab="story">Story</button>
          <button class="tab-btn" role="tab" aria-selected="false" data-tab="interview">Interview</button>
          <button class="tab-btn" role="tab" aria-selected="false" data-tab="universe">Universe</button>
          <button class="tab-btn" role="tab" aria-selected="false" data-tab="links">Links</button>
        </div>
        <div class="tab-panel is-active" data-panel="story">
          <div class="tab-text">
            <p>Fran Rodríguez — known online as <em>lacabezaenlasnubes</em>, “head in the clouds” — is a digital-collage artist based in Barcelona, born in a small industrial town in northern Spain. Raised in a working-class family that prized books and music, he has been a full-time freelance artist for around twenty years.</p>
            <p>Largely self-taught through online forums, he spent a decade in Madrid as an advertising art director before going freelance. He has created album and concert artwork for <strong>Tame Impala, Weezer, Coldplay and Tycho</strong>, and exhibits and sells internationally — entering the NFT space in 2021 with “Postcards From a Dream”, then “Quantum Landscapes”.</p>
            <p>His work is surreal and psychedelic: dreamscapes and meditation, outer space and nature, the human figure before the immensity of the cosmos.</p>
          </div>
        </div>
        <div class="tab-panel" data-panel="interview">
          <div class="tab-text">
            <blockquote class="iv">“Art has to be honest. Really honest. I like art that offers an alternative way of seeing things.”</blockquote>
            <blockquote class="iv">“I like the freedom NFTs give artists — the opportunity to work and live off your art without depending on managers.”</blockquote>
            <blockquote class="iv">“Message, no doubt. The technique seems totally secondary.”</blockquote>
            <a class="btn btn-ghost" href="https://medium.com/cryptocomnft/creator-community-fran-rodri%CC%81guez-f7f1734a3bd0" target="_blank" rel="noopener">Read the full interview
              <svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
        </div>
        <div class="tab-panel" data-panel="universe">
          <div class="tab-text">
            <p>The Cryptonauts are explorers of the metaverse, citizens of the Cronos chain — quantum astronauts who have been everywhere, at all times. Across <strong>thirteen curated, fully sold-out drops</strong> on crypto.com, the saga has grown into an expanding universe of 1/1 avatars full of psychedelia and cosmic surrealism, where holders receive full IP rights, airdrops and rewards.</p>
            <p class="tab-tagline">“Like a mind altering substance, without the risk.”</p>
          </div>
        </div>
        <div class="tab-panel" data-panel="links">
          <div class="links-group"><h4 class="links-h">Cryptonauts &amp; art</h4>
          <div class="artist-links">
        <a href="https://crypto.com/nft/profile/cabezaenlasnubes?tab=created" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7l8-4 8 4v10l-8 4-8-4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Crypto.com NFT</span>
          <span class="lc-sub">Artist profile &amp; drops</span>
        </a>
        <a href="https://franrodriguezart.com/" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke-linecap="round"/></svg> Website</span>
          <span class="lc-sub">Portfolio &amp; prints</span>
        </a>
        <a href="https://lacabezaenlasnubes.cargo.site/" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/></svg> Portfolio</span>
          <span class="lc-sub">lacabezaenlasnubes</span>
        </a>
          </div></div>
          <div class="links-group"><h4 class="links-h">Social &amp; community</h4>
          <div class="artist-links">
        <a href="https://x.com/cryptonautscdc" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X / Twitter</span>
          <span class="lc-sub">@cryptonautscdc</span>
        </a>
        <a href="https://instagram.com/lacabezaenlasnubes" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> Instagram</span>
          <span class="lc-sub">@lacabezaenlasnubes</span>
        </a>
        <a href="https://lacabezaenlasnubes.myshopify.com" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 016 0"/></svg> Shop</span>
          <span class="lc-sub">Prints &amp; merch</span>
        </a>
        <a href="https://discord.com/invite/TyTazHHgdV" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M20.317 4.369a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 00-5.487 0 12.6 12.6 0 00-.617-1.25.077.077 0 00-.079-.036A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.2 14.2 0 001.226-1.994.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.009c.12.099.245.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.893.077.077 0 00-.041.106c.36.698.772 1.363 1.225 1.993a.076.076 0 00.084.029 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.057c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> Discord</span>
          <span class="lc-sub">Join the crew</span>
        </a>
        <a href="https://linktr.ee/cryptonautscdc" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M9 15l6-6M10 7h5v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg> Linktree</span>
          <span class="lc-sub">Every official link</span>
        </a>
          </div></div>
          <div class="links-group"><h4 class="links-h">Press</h4>
          <div class="artist-links">
        <a href="https://medium.com/cryptocomnft/creator-community-fran-rodri%CC%81guez-f7f1734a3bd0" target="_blank" rel="noopener" class="link-card">
          <span class="lc-head"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg> Interview</span>
          <span class="lc-sub">crypto.com Creator Community</span>
        </a>
          </div></div>
        </div>
      </div>
    </section>
  </main>

  <section id="collectionView" data-view="collection" class="hidden-view" aria-label="Collection detail">
    <div class="cv-banner">
      <img class="cv-banner-img" src="" alt="" decoding="async">
      <div class="cv-banner-grad"></div>
      <button class="cv-back" type="button" aria-label="Back to collections">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All collections
      </button>
      <h1 class="cv-title"></h1>
      <img class="cv-logo" src="" alt="">
    </div>
    <div class="cv-inner">
      <div class="cv-meta">
        <span class="cv-release"></span>
        <span class="cv-sold" hidden>Sold out</span>
        <p class="cv-desc"></p>
        <a class="cv-link btn btn-primary" target="_blank" rel="noopener">View on crypto.com
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </div>
      <div class="cv-stats">
        <div class="cv-stat"><span class="v cv-holders">0</span><span class="l">Holders</span></div>
        <div class="cv-stat"><span class="v cv-items">0</span><span class="l">Items</span></div>
        <div class="cv-stat"><span class="v cv-floor">—</span><span class="l">Floor</span></div>
        <div class="cv-stat"><span class="v cv-vol">—</span><span class="l">Volume</span></div>
        <div class="cv-stat"><span class="v cv-sales">0</span><span class="l">Sales</span></div>
      </div>
      <div class="cv-block">
        <h2 class="cv-sec-title">Items <span class="cv-count cv-items-count"></span></h2>
        <div class="cm-nfts" id="cvNfts"></div>
        <button class="cv-more" id="cvMore" type="button" hidden>Load more items</button>
      </div>
      <div class="cv-block">
        <h2 class="cv-sec-title">Holders <span class="cv-count cv-holders-count"></span></h2>
        <ul class="cm-list" id="cvList"></ul>
      </div>
    </div>
  </section>

  <footer>
    <div class="footer-left">
      <img src="assets/logo.png" alt="Cronobots">
      <p>Built by <a href="https://x.com/Cronos_WTF" target="_blank" rel="noopener">Unscoop</a></p>
    </div>
    <button id="installBtn" class="install-btn">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Install app
    </button>
    <div class="footer-right">
      <p>Last updated ${new Date().toISOString().slice(0, 10)}</p>
    </div>
  </footer>

  <div id="collectionModal" class="modal" hidden role="dialog" aria-modal="true" aria-labelledby="cmTitle">
    <div class="modal-box">
      <button class="modal-close" id="collectionModalClose" aria-label="Close">&times;</button>
      <div class="cm-header">
        <img class="cm-cover" src="" alt="" loading="lazy" decoding="async">
        <h2 class="cm-title" id="cmTitle"></h2>
        <div class="cm-stats">
          <div class="cm-stat"><span class="v cm-holders">0</span><span class="l">Holders</span></div>
          <div class="cm-stat"><span class="v cm-floor">—</span><span class="l">Floor</span></div>
          <div class="cm-stat"><span class="v cm-vol">—</span><span class="l">Volume</span></div>
          <div class="cm-stat"><span class="v cm-sales">0</span><span class="l">Sales</span></div>
        </div>
        <p class="cm-desc"></p>
        <a class="cm-link" target="_blank" rel="noopener" hidden>
          View on crypto.com
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </div>
      <h3 class="cm-sec">Items</h3>
      <div class="cm-nfts" id="cmNfts"></div>
      <h3 class="cm-sec">Holders</h3>
      <ul class="cm-list"></ul>
    </div>
  </div>

  <script>
    const collectionsData = ${JSON.stringify(allCollectionsData)};
    const globalOwnersData = ${JSON.stringify(globalOwnersData)};

    function validateUrl(url) {
      return url.startsWith('https://crypto.com/nft/profile/') ? url : '#';
    }

    function validateTwitterUrl(url) {
      return url && url.startsWith('https://x.com/') ? url : '#';
    }

    function getTwitterHandle(url) {
      return url && url.startsWith('https://x.com/') ? '@' + url.split('https://x.com/')[1] : '';
    }

    // Métadonnées officielles des collections (crypto.com GraphQL + Linktree) :
    // identifiant on-chain, statut, supply et récit. Clé = titre exact de la collection.
    const COLLECTION_META = {
      "Legendary Cryptonauts V2": { id: "aabff17f9874020416137984b9d2b8db", items: 328, soldOut: true, desc: "The legend continues. The quantum spacetime travelers are back — over 300 new 1/1 avatars full of psychedelia and cosmic epicness. Holders get full IP rights, airdrops and rewards. Fran Rodríguez returns with the 9th collection of the sold-out Cryptonauts saga: after 13 curated drops and 400K+ dollars in total volume, his most psychedelic collection to date." },
      "OG Cryptonauts": { id: "0a9144ea31f81338454f87a1eaf101c1", items: 210, soldOut: true, desc: "An exclusive drop for holders of the Cryptonaut OG pass. The original Cryptonauts return for one last mission before becoming a true rarity in the cosmos — the original suit from the saga, created four years ago and now a legend. Rare. Scarce. Epic. Unique. Fran Rodríguez's 13th drop on Crypto.com." },
      "Time Travel Cryptonauts II": { id: "a870c453ec57dc8e706e999b3f37a859", items: 462, soldOut: true, desc: "The Time Travel Cryptonauts are back — 453 new quantum time travelers. They journeyed into the past and shared the knowledge of astrophysics with the most primitive humans. Time has changed forever." },
      "Legendary Cryptonauts": { id: "c220b3299c59deccf1340251036ac4ac", items: 326, soldOut: true, desc: "The legend begins here. Magic and science go hand in hand in an adventure through the fabric of space and time. Fran Rodríguez's sixth collection of the sold-out Cryptonauts saga: after 10 curated drops and 320K+ dollars in total volume, his most epic and biggest collection to date." },
      "TIME TRAVEL Cryptonauts": { id: "98d9a2bfd53bd130fc267c9c92ed3236", items: 241, soldOut: true, desc: "Meet the Time Travel Cryptonauts — quantum travelers who journeyed into the past to share astrophysics with primitive humans, and returned from the farthest future with revolutionary forms of energy. Time has changed forever. Fran Rodríguez's fifth collection of the saga." },
      "Quantum Cryptonauts V2": { id: "89d7138226413ae153f306dd5cfabf33", items: 119, soldOut: true, desc: "The Quantum Cryptonauts — the dark knights of the cosmos. They are everywhere at once; they feel and know everything. Fran Rodríguez's fourth chapter of the saga and his first fully animated avatars, after seven curated drops and 300K+ dollars in total volume." },
      "Quantum Cryptonauts": { id: "bbcd969a80642cf8934d33061be8a194", items: 129, soldOut: true, desc: "The Quantum Cryptonauts — the dark knights of the cosmos. They are everywhere at once; they feel and know everything. An epic, highly awaited collection full of psychedelia and cosmic surrealism, after seven curated drops and 275K+ dollars in total volume. Join the crew." },
      "Cryptonauts 2024": { id: "10615ea6d69edfc24975c419941304e3", items: 115, soldOut: true, desc: "The Cryptonauts are explorers of the metaverse, citizens of the Cronos chain — they have been everywhere, at all times. A group of quantum astronauts whose advanced technology let them reach the deepest corners of the mind, and a world of endless possibilities." },
      "Cryptonauts Golden Crew": { id: "f1d242e1c49e009427b38fc953ef4e89", items: 12, soldOut: true, desc: "An exclusive collection of 1/1 Cryptonauts reserved for the top holders and VIP members of the community." },
      "Cryptonauts: The dark side of the dune": { id: "da522f33fb5285981f6d154e575fe0a3", items: 22, soldOut: true, desc: "Fran Rodríguez presents 'The dark side of the dune', the second chapter of the sold-out Cryptonauts saga. After years beyond the solar system, the Cryptonauts have found planets fit for life — humanity is ready to colonize another system. Join the space pioneers and conquer new worlds." },
      "Cryptonauts": { id: "c942e9924b01fae996d8f817060611eb", items: 24, soldOut: true, desc: "Fran Rodríguez presents Cryptonauts, the first saga of his universe on Crypto.com. The Cryptonauts are explorers of the metaverse, citizens of the Cronos chain — brave quantum astronauts whose technology lets them reach the deepest corners of the mind, and a world of endless possibilities." }
    };

    // Statistiques de marché réelles (crypto.com GraphQL — GetCollectionMetric) :
    // floor, volume échangé (USD), nombre de ventes secondaires, supply on-chain.
    const COLLECTION_STATS = {
      "Legendary Cryptonauts V2": { floor: 45, vol: 11607, sales: 233, supply: 328 },
      "OG Cryptonauts": { floor: 40, vol: 10455, sales: 219, supply: 210 },
      "Time Travel Cryptonauts II": { floor: 20, vol: 23651, sales: 522, supply: 463 },
      "Legendary Cryptonauts": { floor: 5, vol: 18448, sales: 400, supply: 326 },
      "TIME TRAVEL Cryptonauts": { floor: 10, vol: 20563, sales: 455, supply: 241 },
      "Quantum Cryptonauts V2": { floor: 5, vol: 11590, sales: 252, supply: 120 },
      "Quantum Cryptonauts": { floor: 10, vol: 25501, sales: 480, supply: 140 },
      "Cryptonauts 2024": { floor: 5, vol: 17954, sales: 420, supply: 116 },
      "Cryptonauts Golden Crew": { floor: 0, vol: 1002, sales: 23, supply: 12 },
      "Cryptonauts: The dark side of the dune": { floor: 42, vol: 17393, sales: 299, supply: 22 },
      "Cryptonauts": { floor: 52, vol: 35758, sales: 611, supply: 24 }
    };
    const SAGA_STATS = { volume: 193922, sales: 3914, items: 2002 };

    // Date de sortie sur crypto.com (mint du 1er NFT) — pour l'ordre chronologique.
    const COLLECTION_RELEASE = {
      "Legendary Cryptonauts V2": "Mar 2026",
      "OG Cryptonauts": "Jan 2026",
      "Time Travel Cryptonauts II": "Aug 2025",
      "Legendary Cryptonauts": "Jun 2025",
      "TIME TRAVEL Cryptonauts": "Feb 2025",
      "Quantum Cryptonauts V2": "Dec 2024",
      "Quantum Cryptonauts": "Jul 2024",
      "Cryptonauts 2024": "May 2024",
      "Cryptonauts Golden Crew": "Apr 2024",
      "Cryptonauts: The dark side of the dune": "Nov 2023",
      "Cryptonauts": "May 2023"
    };

    // Format compact des montants en dollars ($45 · $11.6K · $194K).
    function fmtMoney(n) {
      if (n == null || n === 0) return '—';
      if (n >= 100000) return '$' + Math.round(n / 1000) + 'K';
      if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
      return '$' + n;
    }

    // Carte de collection (galerie). Le détail des propriétaires s'ouvre dans une modale.
    // Ligne-bannière d'une collection : fond = bannière (chargée en direct), logo à gauche,
    // titre centré, stats à droite. Tout le bloc est un lien vers la page de la collection.
    function renderCollection(collection, index) {
      try {
        const meta = COLLECTION_META[collection.title] || {};
        const st = COLLECTION_STATS[collection.title] || {};
        const total = collection.owners.reduce((sum, o) => sum + (o.count || 0), 0);
        const items = st.supply || total;
        const rel = COLLECTION_RELEASE[collection.title] || '';
        const a = document.createElement('a');
        a.className = 'col-row';
        a.href = '#c/' + index;
        a.setAttribute('aria-label', 'View ' + collection.title);
        a.style.animationDelay = (Math.min(index || 0, 14) * 0.05) + 's';
        a.innerHTML = \`
          <div class="col-bg" data-cid="\${meta.id || ''}"></div>
          <div class="col-grad"></div>
          \${meta.soldOut ? '<span class="col-sold">Sold out</span>' : ''}
          <img class="col-logo" src="\${collection.image}" alt="\${collection.alt}" loading="lazy" decoding="async">
          <div class="col-title-wrap">
            <h3 class="col-title">\${collection.title}</h3>
            \${rel ? \`<span class="col-date">\${rel}</span>\` : ''}
          </div>
          <div class="col-stats">
            <div class="col-stat"><span class="cv">\${(collection.ownersCount || 0).toLocaleString('fr-FR')}</span><span class="cl">Holders</span></div>
            <div class="col-stat"><span class="cv">\${(items || 0).toLocaleString('fr-FR')}</span><span class="cl">Items</span></div>
          </div>
        \`;
        return a;
      } catch (error) {
        console.error(\`Error rendering collection \${collection.title}:\`, error);
        return document.createElement('a');
      }
    }

    // Construit les lignes de propriétaires classées (réutilisé par la modale).
    function buildOwnerRowsHTML(owners) {
      const sorted = [...owners].sort((a, b) => b.count - a.count);
      let rank = 1, prev = null;
      return sorted.map((o, i) => {
        if (i > 0 && o.count < prev) rank += 1;
        prev = o.count;
        const rc = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
        const tw = o.twitter ? \`<a href="\${validateTwitterUrl(o.twitter)}" target="_blank" rel="noopener noreferrer" class="twitter-link">\${getTwitterHandle(o.twitter)}</a>\` : '';
        return \`<li class="\${rc}"><div class="lb-left"><span class="rank">\${rank}</span><a class="lb-name" href="\${validateUrl(o.url)}" target="_blank" rel="noopener noreferrer">\${o.name}</a>\${tw}</div><span class="lb-count"><span class="n">\${o.count}</span><span class="t">NFT\${o.count > 1 ? 's' : ''}</span></span></li>\`;
      }).join('');
    }

    // Ouvre la modale détaillée d'une collection.
    // Échappe le texte injecté en HTML.
    function escHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Aperçu des NFT d'une collection, chargé en direct depuis le GraphQL crypto.com.
    const NFT_GQL = 'https://crypto.com/nft-api/graphql';
    const nftCache = {};
    let nftActiveId = null;
    function nftCardsHTML(assets) {
      return (assets || []).map(a => {
        const base = (a.cover && a.cover.url) || (a.main && a.main.url) || '';
        const thumb = base ? base + '?d=lg-logo' : '';
        return \`<a class="nft" href="https://crypto.com/nft/collectible/\${a.id}" target="_blank" rel="noopener" title="\${escHtml(a.name)}">\`
          + \`<span class="nft-img">\${thumb ? \`<img src="\${thumb}" alt="\${escHtml(a.name)}" loading="lazy" decoding="async">\` : ''}</span>\`
          + \`<span class="nft-name">\${escHtml(a.name)}</span></a>\`;
      }).join('');
    }
    function renderNfts(el, assets) {
      el.innerHTML = (assets && assets.length) ? nftCardsHTML(assets) : '<p class="cm-empty">No preview available.</p>';
    }
    async function loadCollectionNfts(collectionId) {
      const el = document.getElementById('cmNfts');
      if (!el) return;
      nftActiveId = collectionId;
      if (!collectionId) { el.innerHTML = ''; return; }
      if (nftCache[collectionId]) { renderNfts(el, nftCache[collectionId]); return; }
      el.innerHTML = '<span class="nft skeleton"></span>'.repeat(8);
      try {
        const res = await fetch(NFT_GQL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            variables: { id: collectionId, first: 24, skip: 0 },
            query: 'query($id:ID,$first:Int!,$skip:Int!){public{assets(collectionId:$id,first:$first,skip:$skip){id name cover{url} main{url}}}}'
          })
        });
        const data = await res.json();
        const assets = (data && data.data && data.data.public && data.data.public.assets) || [];
        nftCache[collectionId] = assets;
        if (nftActiveId === collectionId) renderNfts(el, assets);
      } catch (e) {
        if (nftActiveId === collectionId) el.innerHTML = '<p class="cm-empty">Could not load items.</p>';
      }
    }

    // ───────── Page détaillée d'une collection (vue plein écran, routage #c/<i>) ─────────
    const bannerCache = {};
    const cv = { id: null, idx: -1, skip: 0, total: 0, loading: false };

    async function fetchBanner(id) {
      if (bannerCache[id] !== undefined) return bannerCache[id];
      try {
        const res = await fetch(NFT_GQL, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variables: { id }, query: 'query($id:ID!){public{collection(id:$id){banner{url} logo{url}}}}' })
        });
        const data = await res.json();
        const c = (data && data.data && data.data.public && data.data.public.collection) || {};
        bannerCache[id] = { banner: (c.banner && c.banner.url) || '', logo: (c.logo && c.logo.url) || '' };
      } catch (e) { bannerCache[id] = { banner: '', logo: '' }; }
      return bannerCache[id];
    }

    // Vues séparées : une seule section affichée à la fois (Home / Collections / Stats / Leaderboard / Artist / collection).
    const VIEWS = ['home', 'collections', 'stats', 'leaderboard', 'artist'];
    let spotlightLoaded = false;
    let collectionsAnimated = false;
    function syncNav(name) {
      document.querySelectorAll('.nav-links a[data-nav]').forEach(a => {
        a.classList.toggle('is-active', a.dataset.nav === name);
      });
    }
    function showView(name) {
      document.body.dataset.view = name;
      document.querySelectorAll('[data-view]').forEach(el => {
        const match = el.dataset.view === name;
        el.classList.toggle('hidden-view', !match);
        if (match) {
          if (el.classList.contains('reveal')) el.classList.add('in-view');
          el.querySelectorAll('.reveal').forEach(r => r.classList.add('in-view'));
        }
      });
      syncNav(name === 'collection' ? 'collections' : name);
      window.scrollTo(0, 0);
      if (name === 'home' && !spotlightLoaded) { spotlightLoaded = true; loadSpotlight(); }
      if (name === 'collections' && !collectionsAnimated) {
        collectionsAnimated = true;
        loadGalleryBanners();
      }
    }

    // Charge les bannières de fond des lignes de la galerie (en direct, en cache).
    function loadGalleryBanners() {
      document.querySelectorAll('.col-bg[data-cid]').forEach(el => {
        const cid = el.dataset.cid;
        if (!cid) return;
        fetchBanner(cid).then(b => { if (b.banner) el.style.backgroundImage = 'url("' + b.banner + '")'; });
      });
    }

    // Spotlight : mur d'œuvres en mouvement (chargé en direct depuis crypto.com).
    async function loadSpotlight() {
      const wall = document.getElementById('spotWall');
      if (!wall) return;
      const rowA = document.getElementById('spotRowA');
      const rowB = document.getElementById('spotRowB');
      const skel = '<span class="spot-nft spot-skel"></span>'.repeat(8);
      rowA.innerHTML = skel; rowB.innerHTML = skel;
      try {
        const res = await fetch(NFT_GQL, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variables: { id: 'aabff17f9874020416137984b9d2b8db', first: 28, skip: 0 }, query: 'query($id:ID,$first:Int!,$skip:Int!){public{assets(collectionId:$id,first:$first,skip:$skip){id name cover{url} main{url}}}}' })
        });
        const data = await res.json();
        const assets = (data && data.data && data.data.public && data.data.public.assets) || [];
        if (!assets.length) { const s = document.getElementById('spotlight'); if (s) s.classList.add('hidden-view'); return; }
        const tile = a => {
          const u = ((a.cover && a.cover.url) || (a.main && a.main.url) || '') + '?d=lg-logo';
          return '<a class="spot-nft" href="https://crypto.com/nft/collectible/' + a.id
            + '" target="_blank" rel="noopener" title="' + escHtml(a.name) + '">'
            + '<img src="' + u + '" alt="' + escHtml(a.name) + '" loading="lazy" decoding="async"></a>';
        };
        const half = Math.ceil(assets.length / 2);
        const a1 = assets.slice(0, half).map(tile).join('');
        const a2 = assets.slice(half).map(tile).join('');
        rowA.innerHTML = a1 + a1;   // dupliqué pour une boucle sans couture
        rowB.innerHTML = a2 + a2;
      } catch (e) {
        const s = document.getElementById('spotlight'); if (s) s.classList.add('hidden-view');
      }
    }

    function showCollectionView(idx) {
      const view = document.getElementById('collectionView');
      const collection = (typeof collectionsData !== 'undefined') ? collectionsData[idx] : null;
      if (!view || !collection) { showHome(); return; }
      cv.idx = idx;
      const title = collection.title;
      const meta = COLLECTION_META[title] || {};
      const st = COLLECTION_STATS[title] || {};
      cv.id = meta.id || null;
      cv.skip = 0; cv.total = st.supply || 0; cv.loading = false;

      view.querySelector('.cv-title').textContent = title;
      view.querySelector('.cv-release').textContent = COLLECTION_RELEASE[title] || '';
      const logo = view.querySelector('.cv-logo');
      logo.src = collection.image; logo.alt = title;
      view.querySelector('.cv-desc').textContent = meta.desc || '';
      const link = view.querySelector('.cv-link');
      if (meta.id) { link.href = 'https://crypto.com/nft/collection/' + meta.id; link.hidden = false; } else { link.hidden = true; }
      const sold = view.querySelector('.cv-sold'); if (sold) sold.hidden = !meta.soldOut;
      const setStat = (k, v) => { const e = view.querySelector('.cv-' + k); if (e) e.textContent = v; };
      setStat('holders', (collection.ownersCount || 0).toLocaleString('fr-FR'));
      setStat('items', (st.supply || 0).toLocaleString('fr-FR'));
      setStat('floor', fmtMoney(st.floor));
      setStat('vol', fmtMoney(st.vol));
      setStat('sales', (st.sales || 0).toLocaleString('fr-FR'));
      view.querySelector('.cv-items-count').textContent = st.supply ? '(' + st.supply.toLocaleString('fr-FR') + ')' : '';
      view.querySelector('.cv-holders-count').textContent = '(' + (collection.ownersCount || 0).toLocaleString('fr-FR') + ')';
      view.querySelector('#cvList').innerHTML = buildOwnerRowsHTML(collection.owners);

      const bannerImg = view.querySelector('.cv-banner-img');
      bannerImg.removeAttribute('src');
      view.classList.remove('has-banner');
      const grid = document.getElementById('cvNfts');
      grid.innerHTML = '<span class="nft skeleton"></span>'.repeat(12);
      document.getElementById('cvMore').hidden = true;

      showView('collection');

      if (cv.id) {
        fetchBanner(cv.id).then(b => {
          if (cv.idx !== idx) return;
          if (b.banner) { bannerImg.src = b.banner; view.classList.add('has-banner'); }
        });
        grid.innerHTML = '';
        cvLoadMore(idx);
      } else {
        grid.innerHTML = '<p class="cm-empty">No items available.</p>';
      }
    }

    async function cvLoadMore(idx) {
      if (cv.loading || cv.id == null) return;
      cv.loading = true;
      const grid = document.getElementById('cvNfts');
      const moreBtn = document.getElementById('cvMore');
      moreBtn.disabled = true;
      try {
        const res = await fetch(NFT_GQL, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variables: { id: cv.id, first: 50, skip: cv.skip }, query: 'query($id:ID,$first:Int!,$skip:Int!){public{assets(collectionId:$id,first:$first,skip:$skip){id name cover{url} main{url}}}}' })
        });
        const data = await res.json();
        if (cv.idx !== idx) { cv.loading = false; moreBtn.disabled = false; return; }
        const assets = (data && data.data && data.data.public && data.data.public.assets) || [];
        grid.insertAdjacentHTML('beforeend', nftCardsHTML(assets));
        cv.skip += assets.length;
        moreBtn.hidden = assets.length < 50;
      } catch (e) {
        if (cv.skip === 0) grid.innerHTML = '<p class="cm-empty">Could not load items.</p>';
      }
      moreBtn.disabled = false;
      cv.loading = false;
    }

    function handleRoute() {
      const h = location.hash || '';
      const m = h.match(/^#c\\/(\\d+)$/);
      if (m) { showCollectionView(parseInt(m[1], 10)); return; }
      const name = h.replace('#', '') || 'home';
      showView(VIEWS.includes(name) ? name : 'home');
    }

    // Tableau récapitulatif des stats de chaque collection (section Stats).
    function buildStatsTable() {
      const el = document.getElementById('statsTable');
      if (!el || typeof collectionsData === 'undefined') return;
      const rows = collectionsData.map(c => {
        const st = COLLECTION_STATS[c.title] || {};
        const total = c.owners.reduce((s, o) => s + (o.count || 0), 0);
        return { title: c.title, image: c.image, release: COLLECTION_RELEASE[c.title] || '', holders: c.ownersCount || 0, items: st.supply || total, floor: st.floor, vol: st.vol || 0 };
      });
      el.innerHTML = '<div class="st-row st-head"><span class="st-name">Collection</span><span>Items</span><span>Holders</span><span>Floor</span><span>Volume</span></div>'
        + rows.map(r => \`<div class="st-row">\`
          + \`<span class="st-name"><img src="\${r.image}" alt="" loading="lazy" decoding="async"><span class="st-meta"><span class="st-title">\${escHtml(r.title)}</span>\${r.release ? \`<span class="st-rel">\${r.release}</span>\` : ''}</span></span>\`
          + \`<span data-l="Items">\${(r.items || 0).toLocaleString('fr-FR')}</span>\`
          + \`<span data-l="Holders">\${r.holders.toLocaleString('fr-FR')}</span>\`
          + \`<span data-l="Floor">\${fmtMoney(r.floor)}</span>\`
          + \`<span data-l="Volume">\${fmtMoney(r.vol)}</span></div>\`).join('');
    }

    function openCollectionModal(collection) {
      const modal = document.getElementById('collectionModal');
      if (!modal) return;
      const cover = modal.querySelector('.cm-cover');
      cover.src = collection.image;
      cover.alt = collection.title;
      modal.querySelector('.cm-title').textContent = collection.title;
      const st = COLLECTION_STATS[collection.title] || {};
      modal.querySelector('.cm-holders').textContent = (collection.ownersCount || 0).toLocaleString('fr-FR');
      modal.querySelector('.cm-floor').textContent = fmtMoney(st.floor);
      modal.querySelector('.cm-vol').textContent = fmtMoney(st.vol);
      modal.querySelector('.cm-sales').textContent = (st.sales || 0).toLocaleString('fr-FR');
      const meta = COLLECTION_META[collection.title] || {};
      const descEl = modal.querySelector('.cm-desc');
      const linkEl = modal.querySelector('.cm-link');
      if (descEl) { descEl.textContent = meta.desc || ''; descEl.hidden = !meta.desc; }
      if (linkEl) {
        if (meta.id) { linkEl.href = 'https://crypto.com/nft/collection/' + meta.id; linkEl.hidden = false; }
        else { linkEl.hidden = true; }
      }
      modal.querySelector('.cm-list').innerHTML = buildOwnerRowsHTML(collection.owners);
      loadCollectionNfts(meta.id);
      modal.hidden = false;
      const box = modal.querySelector('.modal-box');
      if (box) box.scrollTop = 0;
      document.documentElement.style.overflow = 'hidden';
      const closeBtn = modal.querySelector('.modal-close');
      if (closeBtn) closeBtn.focus();
    }

    function renderGlobalOwners(owners) {
      try {
        const sortedOwners = [...owners].sort((a, b) => b.count - a.count);
        let currentRank = 1;
        let previousCount = null;
        const rankedOwners = sortedOwners.map((owner, index) => {
          if (index > 0 && owner.count < previousCount) {
            currentRank += 1;
          }
          previousCount = owner.count;
          let rankClass = '';
          if (currentRank === 1) rankClass = 'rank-1';
          else if (currentRank === 2) rankClass = 'rank-2';
          else if (currentRank === 3) rankClass = 'rank-3';
          return { ...owner, rank: currentRank, rankClass };
        });

        const topTenOwners = rankedOwners.slice(0, 10);
        const additionalOwners = rankedOwners.slice(10);

        const section = document.createElement('section');
        section.className = 'leaderboard-section section reveal hidden-view';
        section.id = 'leaderboard';
        section.dataset.view = 'leaderboard';
        section.innerHTML = \`
          <div class="section-head">
            <span class="eyebrow">◆ Global Ranking</span>
            <h2 class="section-title">Leaderboard</h2>
            <p class="section-sub">The top holders across every Cryptonauts collection, combined.</p>
          </div>
          <div class="summary">
            <input type="text" id="searchInput" placeholder="SEARCH OWNER" aria-label="Search owners">
            <ul id="global-owners">
              \${topTenOwners.map(owner => \`
                <li class="\${owner.rankClass}">
                  <div class="left-container">
                    <span class="rank">\${owner.rank}</span>
                    <a href="\${validateUrl(owner.url)}" target="_blank" rel="noopener noreferrer">\${owner.name}</a>
                    \${owner.twitter ? \`<a href="\${validateTwitterUrl(owner.twitter)}" target="_blank" rel="noopener noreferrer" class="twitter-link">\${getTwitterHandle(owner.twitter)}</a>\` : ''}
                  </div>
                  <span class="count-container"><span class="count-number">\${owner.count}</span><span class="count-text">CRYPTONAUTS</span></span>
                </li>
              \`).join('')}
            </ul>
            \${additionalOwners.length ? \`
              <span class="show-more-btn" id="show-more-owners" aria-expanded="false" aria-label="Toggle additional owners">SHOW MORE</span>
              <ul id="additional-owners" class="hidden">
                \${additionalOwners.map(owner => \`
                  <li class="\${owner.rankClass}">
                    <div class="left-container">
                      <span class="rank">\${owner.rank}</span>
                      <a href="\${validateUrl(owner.url)}" target="_blank" rel="noopener noreferrer">\${owner.name}</a>
                      \${owner.twitter ? \`<a href="\${validateTwitterUrl(owner.twitter)}" target="_blank" rel="noopener noreferrer" class="twitter-link">\${getTwitterHandle(owner.twitter)}</a>\` : ''}
                    </div>
                    <span class="count-container"><span class="count-number">\${owner.count}</span><span class="count-text">CRYPTONAUTS</span></span>
                  </li>
                \`).join('')}
              </ul>
            \` : ''}
          </div>
          <img src="assets/Footer.png" alt="Cryptonauts Footer Banner" class="footer-image" loading="lazy" decoding="async">
        \`;
        return section;
      } catch (error) {
        console.error('Error rendering global owners:', error);
        return document.createElement('section');
      }
    }

    function debounce(func, wait) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }

    function animateCount(el, target) {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || !target) { el.textContent = target.toLocaleString('fr-FR'); return; }
      const duration = 1200;
      let startTs = null;
      function step(ts) {
        if (startTs === null) startTs = ts;
        const p = Math.min((ts - startTs) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('fr-FR');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function buildStatsBand() {
      try {
        const main = document.querySelector('main');
        if (!main || typeof globalOwnersData === 'undefined') return;
        const uniqueOwners = globalOwnersData.length;
        const totalNFTs = globalOwnersData.reduce((sum, o) => sum + (o.count || 0), 0);
        const collectionsCount = collectionsData.length;
        const stats = [
          { value: uniqueOwners, label: 'Holders' },
          { value: totalNFTs, label: 'Cryptonauts' },
          { value: collectionsCount, label: 'Collections' }
        ];
        const band = document.createElement('section');
        band.className = 'stats-band';
        stats.forEach(s => {
          const card = document.createElement('div');
          card.className = 'stat-card';
          const num = document.createElement('div');
          num.className = 'stat-number';
          num.textContent = '0';
          const lab = document.createElement('div');
          lab.className = 'stat-label';
          lab.textContent = s.label;
          card.appendChild(num);
          card.appendChild(lab);
          band.appendChild(card);
          animateCount(num, s.value);
        });
        const statsHost = document.getElementById('heroStats');
        if (statsHost) statsHost.appendChild(band);
        else main.insertBefore(band, main.firstChild);
      } catch (e) {
        console.error('Error building stats band:', e);
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      try {
        const collectionsContainer = document.getElementById('collections-grid');
        const main = document.querySelector('main');

        if (!collectionsContainer || !main) {
          console.error('Collections container or main element not found');
          return;
        }

        // URL du profil reconstruite depuis le nom (non stockée dans les données → plus léger)
        collectionsData.forEach(collection => {
          collection.owners.forEach(owner => {
            owner.url = 'https://crypto.com/nft/profile/' + owner.name;
            owner.twitter = owner.twitter ? validateTwitterUrl(owner.twitter) : '';
          });
        });

        globalOwnersData.forEach(owner => {
          owner.url = 'https://crypto.com/nft/profile/' + owner.name;
          owner.twitter = owner.twitter ? validateTwitterUrl(owner.twitter) : '';
        });

        collectionsData.forEach((collection, i) => {
          collectionsContainer.appendChild(renderCollection(collection, i));
        });

        const artistSection = document.getElementById('artist');
        main.insertBefore(renderGlobalOwners(globalOwnersData), artistSection);

        // Bandeau de statistiques (compteurs animés)
        buildStatsBand();

        // Tableau récapitulatif par collection (section Stats)
        buildStatsTable();

        // Routage : page détaillée d'une collection (#c/<i>) ↔ accueil
        const cvBack = document.querySelector('#collectionView .cv-back');
        if (cvBack) cvBack.addEventListener('click', () => { location.hash = '#collections'; });
        const cvMoreBtn = document.getElementById('cvMore');
        if (cvMoreBtn) cvMoreBtn.addEventListener('click', () => cvLoadMore(cv.idx));
        window.addEventListener('hashchange', handleRoute);
        handleRoute();

        // Onglets de la section artiste (Story / Interview / Universe / Links)
        const artistTabs = document.getElementById('artistTabs');
        if (artistTabs) {
          artistTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.dataset.tab;
              artistTabs.querySelectorAll('.tab-btn').forEach(b => {
                const on = b === btn;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
              });
              artistTabs.querySelectorAll('.tab-panel').forEach(p => {
                p.classList.toggle('is-active', p.dataset.panel === id);
              });
            });
          });
        }

        // Révélations au défilement (sections + leaderboard)
        const revealEls = document.querySelectorAll('.reveal');
        if ('IntersectionObserver' in window) {
          const ro = new IntersectionObserver((entries) => {
            entries.forEach(e => {
              if (e.isIntersecting) { e.target.classList.add('in-view'); ro.unobserve(e.target); }
            });
          }, { threshold: 0.12 });
          revealEls.forEach(el => ro.observe(el));
        } else {
          revealEls.forEach(el => el.classList.add('in-view'));
        }

        // Accessibilité clavier : bascules SHOW OWNERS / SHOW MORE utilisables au clavier
        document.querySelectorAll('.toggle-btn, .show-more-btn').forEach(el => {
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
          });
        });

        // Compteurs des cartes : animés en bloc à la 1re ouverture de la vue Collections (cf. showView).

        // Fermeture de la modale détaillée d'une collection
        const collectionModal = document.getElementById('collectionModal');
        if (collectionModal) {
          const closeCollectionModal = () => {
            collectionModal.hidden = true;
            document.documentElement.style.overflow = '';
          };
          const cmClose = document.getElementById('collectionModalClose');
          if (cmClose) cmClose.addEventListener('click', closeCollectionModal);
          collectionModal.addEventListener('click', (e) => { if (e.target === collectionModal) closeCollectionModal(); });
          document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !collectionModal.hidden) closeCollectionModal(); });
        }

        const showMoreButton = document.getElementById('show-more-owners');
        if (showMoreButton) {
          showMoreButton.addEventListener('click', () => {
            const additionalOwners = document.getElementById('additional-owners');
            if (additionalOwners) {
              const isHidden = additionalOwners.classList.contains('hidden');
              additionalOwners.classList.toggle('hidden', !isHidden);
              showMoreButton.textContent = isHidden ? 'SHOW LESS' : 'SHOW MORE';
              showMoreButton.setAttribute('aria-expanded', isHidden);
            }
          });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.addEventListener('input', debounce(() => {
            const filter = searchInput.value.toLowerCase().trim();
            const additionalOwners = document.getElementById('additional-owners');
            const showMoreBtn = document.getElementById('show-more-owners');

            // Pendant une recherche, on révèle la liste étendue (sinon les
            // propriétaires classés au-delà du top 10 resteraient introuvables).
            if (additionalOwners) {
              if (filter) {
                additionalOwners.classList.remove('hidden');
              } else {
                additionalOwners.classList.add('hidden');
                if (showMoreBtn) { showMoreBtn.textContent = 'SHOW MORE'; showMoreBtn.setAttribute('aria-expanded', 'false'); }
              }
            }
            if (showMoreBtn) showMoreBtn.style.display = filter ? 'none' : '';

            const listItems = document.querySelectorAll('#global-owners li, #additional-owners li');
            let found = false;

            listItems.forEach(item => {
              const text = item.textContent.toLowerCase();
              const match = text.includes(filter);
              item.style.display = match ? '' : 'none';
              if (match) found = true;
            });

            const noResults = document.getElementById('no-results');
            if (!found) {
              if (!noResults) {
                const msg = document.createElement('li');
                msg.id = 'no-results';
                msg.textContent = 'No results found';
                msg.style.color = '#fff';
                document.getElementById('global-owners').appendChild(msg);
              }
            } else if (noResults) {
              noResults.remove();
            }
          }, 300));
        }

        // Intro d'ouverture : se retire au clic ou à la fin de son fondu
        const intro = document.getElementById('intro');
        if (intro) {
          const dismissIntro = () => intro.remove();
          intro.addEventListener('click', dismissIntro);
          intro.addEventListener('animationend', (e) => { if (e.target === intro) dismissIntro(); });
        }

        // Bouton "retour en haut" + parallaxe léger du champ d'étoiles au défilement
        const scrollTopBtn = document.getElementById('scrollTopBtn');
        const navbar = document.getElementById('navbar');
        const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let starTicking = false;
        const onScroll = () => {
          if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
          if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 30);
          if (!prefersReduced && !starTicking) {
            starTicking = true;
            requestAnimationFrame(() => {
              document.documentElement.style.setProperty('--star-shift', (window.scrollY * 0.12) + 'px');
              starTicking = false;
            });
          }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        if (scrollTopBtn) {
          scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }

        // ── PWA : service worker + installation sur l'écran d'accueil ──
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('sw.js').catch(() => {});
        }
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        const installBtn = document.getElementById('installBtn');
        const installModal = document.getElementById('installModal');
        const installModalClose = document.getElementById('installModalClose');
        const installNow = document.getElementById('installNow');
        let deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          deferredPrompt = e;
          if (installNow) installNow.hidden = false;
        });

        if (installBtn) {
          if (isStandalone) {
            installBtn.hidden = true;
          } else {
            installBtn.addEventListener('click', () => { if (installModal) installModal.hidden = false; });
          }
        }
        if (installModal) {
          const closeModal = () => { installModal.hidden = true; };
          if (installModalClose) installModalClose.addEventListener('click', closeModal);
          installModal.addEventListener('click', (e) => { if (e.target === installModal) closeModal(); });
          document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
        }
        if (installNow) {
          installNow.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installNow.hidden = true;
          });
        }
        window.addEventListener('appinstalled', () => {
          if (installBtn) installBtn.hidden = true;
          if (installModal) installModal.hidden = true;
        });
      } catch (error) {
        console.error('Error in DOMContentLoaded handler:', error);
      }
    });
  </script>

  <button id="scrollTopBtn" aria-label="Retour en haut" title="Retour en haut">↑</button>

  <div id="installModal" class="modal" hidden role="dialog" aria-modal="true" aria-labelledby="installModalTitle">
    <div class="modal-box">
      <button class="modal-close" id="installModalClose" aria-label="Close">×</button>
      <h2 id="installModalTitle">Install the app</h2>
      <p>Cryptonauts Leaderboards ranks the holders of the Cryptonauts NFT collections (crypto.com). Add the page to your home screen to use it like a real app — fullscreen, and even offline.</p>
      <button id="installNow" class="install-now" hidden>Install now</button>
      <h3>On iPhone / iPad (Safari)</h3>
      <ol>
        <li>Tap the <strong>Share</strong> button (square with an up arrow ↑) at the bottom of the screen.</li>
        <li>Scroll down and choose <strong>"Add to Home Screen"</strong>.</li>
        <li>Tap <strong>Add</strong> in the top right.</li>
      </ol>
      <h3>On Android (Chrome)</h3>
      <ol>
        <li>Tap <strong>"Install now"</strong> above, or open the <strong>⋮</strong> menu.</li>
        <li>Choose <strong>"Install app"</strong> (or "Add to Home screen").</li>
        <li>Confirm with <strong>Install</strong>.</li>
      </ol>
    </div>
  </div>
</body>
</html>
`;

  // Write the HTML file directement dans index.html (fichier publié sur GitHub)
  try {
    fs.writeFileSync('index.html', htmlContent, 'utf8');
    console.log('index.html generated successfully.');
  } catch (error) {
    console.error('Error writing index.html:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// processCollection — version GraphQL alignée sur le panel Snapshot d'index.html
//
// Récupère les propriétaires d'une collection en 3 étapes via l'API GraphQL :
//   • Étape 1 : eventHistory (nature: transferred) → propriétaire actuel de
//               chaque asset transféré au moins une fois
//   • Étape 2 : assets(collectionId) → liste de tous les assets avec
//               copies / copiesInCirculation / edition IDs
//   • Étape 2.5 : editions(assetId) → pour chaque NFT multi-édition,
//               toutes les éditions et leurs propriétaires actuels
//   • Étape 3 : edition(id) → pour les single-éditions sans transfert,
//               propriétaire actuel via offerableEditionId
//
// Avantages vs l'ancien scraping Puppeteer :
//   - Beaucoup plus rapide (pas de navigation, scroll, parsing DOM)
//   - Plus correct (multi-éditions correctement comptées via editions(assetId))
//   - Pas de dépendance navigateur
// ─────────────────────────────────────────────────────────────────────────────
async function processCollection(collectionUrl, usePagination, globalOwnerNFTs, collectionsData, ownersData) {
  const collectionId = collectionUrl.split('/').pop();
  let collectionName = '';

  try {
    // ── Infos de collection (nom + métriques officielles pour le log/discrepancy) ──
    let officialItems = 0;
    let officialOwners = 0;
    try {
      const info = await gql('SnapCollectionInfo', { collectionId }, Q_COLLECTION_INFO);
      const c = info?.public?.collection;
      if (c) {
        collectionName = c.name || '';
        // "items" et "editionsCount" — on prend le max comme dans index.html (= "Total Supply" affiché par crypto.com)
        const items = Number(c.metrics?.items) || 0;
        const editionsCount = Number(c.metrics?.editionsCount) || 0;
        officialItems = Math.max(items, editionsCount);
        officialOwners = Number(c.metrics?.owners) || 0;
      }
    } catch (e) {
      console.warn(`Could not fetch collection info: ${e.message}`);
    }

    if (!collectionName) {
      throw new Error(`Failed to retrieve collection name for ${collectionId}`);
    }

    console.log('\nCOLLECTION:');
    console.log(`- ${collectionName}`);
    console.log(`- Total Supply (official): ${officialItems}`);
    console.log(`- Owners (official): ${officialOwners}\n`);

    // ── ÉTAPE 1 — Historique des transferts (paginé) ────────────────────────
    // Pour chaque asset, on récupère le DERNIER propriétaire connu via le
    // premier event "transferred" rencontré (l'historique est en DESC).
    const lastOwner = {}; // assetId → { username, uuid, copies }
    {
      let cursor = null, hasMore = true, pageNum = 0, count = 0;
      console.log('Step 1/3 — Fetching transfer history (paginated)…');
      while (hasMore) {
        pageNum++;
        const data = await gql('SnapHistory',
          { collectionId, first: 100, after: cursor || null, naturesIn: ['transferred'] },
          Q_HISTORY);
        const hist = data?.public?.collection?.eventHistory;
        if (!hist) {
          console.warn('  No event history returned — collection may be invalid or empty.');
          break;
        }
        hist.edges.forEach(({ node }) => {
          if (!node?.asset?.id) return;
          const owner = node.toUser || node.user;
          if (!owner?.username) return;
          if (!lastOwner[node.asset.id]) {
            lastOwner[node.asset.id] = {
              username: owner.username,
              uuid: owner.uuid || owner.username,
              copies: node.asset.copies || 1
            };
          }
          count++;
        });
        cursor = hist.pageInfo.endCursor;
        hasMore = hist.pageInfo.hasNextPage;
      }
      console.log(`  ✓ Step 1: ${pageNum} pages, ${count} events, ${Object.keys(lastOwner).length} assets with at least one transfer.`);
    }

    // ── ÉTAPE 2 — Tous les assets de la collection (paginé) ─────────────────
    const allAssets = [];
    {
      let skip = 0, more = true, pageNum = 0;
      console.log('Step 2/3 — Fetching all collection assets (paginated)…');
      while (more) {
        pageNum++;
        const d = await gql('SnapAllAssets', { collectionId, first: 100, skip }, Q_ALL_ASSETS);
        const batch = d?.public?.assets || [];
        batch.forEach(a => allAssets.push(a));
        skip += 100;
        more = batch.length === 100;
      }
      const totalMinted = allAssets.reduce((s, a) => s + (a.copiesInCirculation != null ? a.copiesInCirculation : (a.copies || 1)), 0);
      console.log(`  ✓ Step 2: ${allAssets.length} unique assets · ${totalMinted} editions minted.`);
    }

    // ── ÉTAPE 2.5 — Vraies éditions des NFTs multi-éditions ─────────────────
    // editions(assetId) renvoie toutes les éditions avec leur propriétaire
    // actuel, page par page. C'est la source autoritative pour les multi-éditions.
    const realEditionsPerAsset = {}; // assetId → [{ id, owner:{uuid,username} }]
    const multiEditionAssets = allAssets.filter(a => (a.copies || 1) > 1);
    if (multiEditionAssets.length > 0) {
      console.log(`Step 2.5/3 — Resolving editions for ${multiEditionAssets.length} multi-edition NFTs (concurrency ${CONCURRENCY})…`);
      let mErrors = 0, mTotalEditions = 0, partialAssets = 0;
      await mapPool(multiEditionAssets, CONCURRENCY, async (a) => {
        const minted = a.copiesInCirculation != null ? a.copiesInCirculation : (a.copies || 1);
        const allEds = [];
        let apiTotalCount = 0;
        try {
          // Pagination interne (PAGE_SIZE = 100) jusqu'à totalCount
          let edSkip = 0;
          let safety = 0;
          const PAGE_SIZE = 100;
          while (safety < 20) {
            safety++;
            const d = await gql('SnapEditionsByAsset',
              { assetId: a.id, first: PAGE_SIZE, skip: edSkip, isDropLast: false },
              Q_EDITIONS_BY_ASSET);
            const result = d?.public?.editions;
            if (!result) break;
            apiTotalCount = result.totalCount || apiTotalCount;
            const eds = result.editions || [];
            if (eds.length === 0) break;
            allEds.push(...eds);
            edSkip += eds.length;
            if (eds.length < PAGE_SIZE) break;
            if (apiTotalCount > 0 && allEds.length >= apiTotalCount) break;
          }
          realEditionsPerAsset[a.id] = allEds;
          mTotalEditions += allEds.length;
          if (allEds.length < minted) {
            partialAssets++;
            console.warn(`  ⚠ "${a.name || a.id}": API returned ${allEds.length}/${minted} editions (totalCount=${apiTotalCount}).`);
          }
        } catch (e) {
          mErrors++;
          console.warn(`  ⚠ Error on asset "${a.name || a.id}": ${e.message}`);
        }
      });
      console.log(`  ✓ Step 2.5: ${mTotalEditions} editions resolved${partialAssets ? ` (${partialAssets} partial)` : ''}${mErrors ? ` (${mErrors} errors)` : ''}.`);
    } else {
      console.log('Step 2.5/3 skipped — no multi-edition NFTs in this collection.');
    }

    // ── ÉTAPE 3 — Owners manquants (single-éditions sans historique) ────────
    const missingAssets = allAssets.filter(a => !lastOwner[a.id] && (a.copies || 1) === 1);
    if (missingAssets.length > 0) {
      console.log(`Step 3/3 — Resolving ${missingAssets.length} owner${missingAssets.length === 1 ? '' : 's'} via edition(id) API (concurrency ${CONCURRENCY})…`);
      let resolved = 0, noEditionId = 0, apiErrors = 0;
      await mapPool(missingAssets, CONCURRENCY, async (a) => {
        const editionId = a.offerableEditionId || a.latestPurchasedEdition?.id || a.defaultListingV2?.editionId;
        if (!editionId) { noEditionId++; return; }
        try {
          const ed = await gql('SnapEdition', { id: editionId }, Q_EDITION_OWNER);
          const owner = ed?.public?.edition?.owner;
          if (owner?.username) {
            lastOwner[a.id] = {
              username: owner.username,
              uuid: owner.uuid || owner.username,
              copies: a.copies || 1
            };
            resolved++;
          }
        } catch (e) { apiErrors++; }
      });
      console.log(`  ✓ Step 3: ${resolved} owners resolved · ${noEditionId} without edition ID · ${apiErrors} API errors.`);
    } else {
      console.log('Step 3/3 skipped — all single-edition NFTs already have an owner from transfer history.');
    }

    // ── AGRÉGATION — Construire ownerNFTs (compatible avec writeCryptonautsHTML) ──
    // Règle (identique à index.html) :
    //   • Multi-edition → on attribue 1 count par édition dont on connaît l'owner
    //   • Single-edition → on attribue 1 count à l'owner (depuis lastOwner)
    //   • Les éditions multi non résolues n'inflatent PAS un holder aléatoire
    const ownerNFTs = {};       // username → count (pour la collection)
    const ownersByUuid = {};    // uuid → username (pour dédupliquer si même user a plusieurs handles)
    let scrapedSupply = 0;

    const addOwner = (username, uuid) => {
      if (!username) return;
      // Dédup : on garde le premier username vu pour un uuid donné, mais on incrémente toujours
      const key = uuid || username;
      if (!ownersByUuid[key]) ownersByUuid[key] = username;
      const canonicalName = ownersByUuid[key];
      ownerNFTs[canonicalName] = (ownerNFTs[canonicalName] || 0) + 1;
      globalOwnerNFTs[canonicalName] = (globalOwnerNFTs[canonicalName] || 0) + 1;
      scrapedSupply++;
    };

    allAssets.forEach(a => {
      const copies = a.copies || 1;
      const minted = a.copiesInCirculation != null ? a.copiesInCirculation : copies;
      if (copies > 1) {
        const realEds = realEditionsPerAsset[a.id];
        if (realEds && realEds.length > 0) {
          realEds.forEach(ed => {
            if (ed?.owner?.username) addOwner(ed.owner.username, ed.owner.uuid);
          });
        }
      } else if (minted > 0) {
        const own = lastOwner[a.id];
        if (own?.username) addOwner(own.username, own.uuid);
      }
    });

    // ── Récupérer les liens Twitter/X pour les nouveaux propriétaires ──
    const newOwners = Object.keys(ownerNFTs).filter(o => !(o in ownersData));
    if (newOwners.length > 0) {
      console.log(`Fetching Twitter usernames for ${newOwners.length} new owner${newOwners.length === 1 ? '' : 's'} (concurrency ${CONCURRENCY})…`);
      await mapPool(newOwners, CONCURRENCY, async (owner) => {
        const twitterUrl = await getTwitterUsername(owner);
        ownersData[owner] = { username: owner, twitter: twitterUrl };
      });
      saveOwnersJson(ownersData); // une seule écriture après tout le batch (vs une par owner avant)
    }

    // ── Logs de discrepancy (identiques à l'ancienne version) ──
    const scrapedOwnersCount = Object.keys(ownerNFTs).length;
    if (officialItems > 0 && scrapedSupply !== officialItems) {
      console.warn(`Discrepancy detected for collection ${collectionName}: Scraped ${scrapedSupply} Cryptonauts, but expected ${officialItems}.`);
    }
    if (officialOwners > 0 && scrapedOwnersCount !== officialOwners) {
      console.warn(`Discrepancy in owner count for collection ${collectionName}: Scraped ${scrapedOwnersCount} owners, but expected ${officialOwners}.`);
    }

    // ── Push vers collectionsData (même format qu'avant) ──
    collectionsData.push({
      collectionId,
      collectionName,
      totalSupply: officialItems > 0 ? officialItems : scrapedSupply,
      owners: officialOwners > 0 ? officialOwners : scrapedOwnersCount,
      ownerNFTs
    });

    console.log(`✅ ${collectionName}: ${scrapedOwnersCount} unique owners · ${scrapedSupply} editions counted.`);
    return { collectionName, ownerNFTs, ok: true };

  } catch (error) {
    console.error(`Error scraping collection ${collectionId}:`, error.message);
    collectionsData.push({
      collectionId,
      collectionName: collectionName || 'Error',
      totalSupply: 0,
      owners: 0,
      ownerNFTs: {}
    });
    return { collectionName: collectionName || 'Error', ownerNFTs: {}, ok: false };
  }
}

async function main() {
  try {
    // Charger Owners.json
    const ownersData = loadOwnersJson();
    const globalOwnerNFTs = {};
    const collectionsData = [];

    // Plus besoin de lancer un navigateur Puppeteer : tout passe par GraphQL.
    const failedCollections = [];
    for (const { url, usePagination } of collectionUrls) {
      console.log(`\n=== Processing collection: ${url} ===`);
      const r = await processCollection(url, usePagination, globalOwnerNFTs, collectionsData, ownersData);
      if (!r.ok) failedCollections.push(url);
      await delay(300); // petite respiration entre collections (anti rate-limit)
    }

    // ── GARDE-FOU n°1 : échec d'au moins une collection ──
    // Si une collection n'a pas pu être récupérée (429 / 403 / réseau), on
    // REFUSE de réécrire index.html avec des données partielles. On sort en
    // erreur pour que publier.ps1/.sh annulent le commit + push.
    if (failedCollections.length > 0) {
      console.error(`\n❌ ${failedCollections.length}/${collectionUrls.length} collection(s) en échec (API bloquée / 429 ?). index.html NON modifié pour ne pas publier des données partielles :`);
      failedCollections.forEach(u => console.error(`   - ${u}`));
      process.exitCode = 1;
      return;
    }

    // Calculer les totaux
    const totalUniqueOwners = Object.keys(globalOwnerNFTs).length;
    const totalCryptonautsAcrossAllCollections = collectionsData.reduce((sum, data) => sum + data.totalSupply, 0);

    console.log('\n=== Global Summary ===');
    console.log(`Total Unique Owners: ${totalUniqueOwners}`);
    console.log(`Total Cryptonauts Across All Collections: ${totalCryptonautsAcrossAllCollections}\n`);

    const scrapedCryptonauts = Object.values(globalOwnerNFTs).reduce((sum, count) => sum + count, 0);
    if (scrapedCryptonauts !== totalCryptonautsAcrossAllCollections) {
      console.warn(`Global discrepancy detected: Scraped ${scrapedCryptonauts} Cryptonauts, but expected ${totalCryptonautsAcrossAllCollections}.`);
    }

    // ── GARDE-FOU n°2 : aucune donnée du tout ──
    // Si aucune donnée n'a été récupérée (API bloquée / 403 / réseau coupé),
    // on REFUSE de réécrire index.html pour ne pas remplacer le site par une
    // page vide. On sort en erreur (exit code 1) pour que publier.ps1/.sh
    // annule le commit + push.
    if (totalUniqueOwners === 0) {
      console.error('\n❌ Aucun propriétaire récupéré (API bloquée / 403 ?). index.html NON modifié pour ne pas écraser le site.');
      process.exitCode = 1;
      return;
    }

    // Sauvegarder Owners.json
    saveOwnersJson(ownersData);

    // Générer le fichier HTML (écrit directement index.html)
    writeCryptonautsHTML(collectionsData, globalOwnerNFTs, ownersData);

  } catch (error) {
    console.error('Main execution failed:', error.message);
    process.exitCode = 1;
  }
}

// Exécuter le script
main().catch(error => {
  console.error('Main execution failed:', error.message);
  process.exitCode = 1;
});
