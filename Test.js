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
      owners: Object.entries(scrapedData.ownerNFTs).map(([name, count]) => ({
        name,
        url: `https://crypto.com/nft/profile/${name}`,
        count,
        twitter: ownersData[name]?.twitter || ''
      }))
    };
  });

  // Prepare globalOwnersData
  const globalOwnersData = assignRanks(Object.entries(globalOwnerNFTs)).map(({ name, url, count, rank }) => ({
    name,
    url,
    count,
    rank,
    twitter: ownersData[name]?.twitter || ''
  }));

  // Generate HTML content
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>CronoBots | Cryptonauts Leaderboards</title>
  <link rel="preload" href="fonts/Geomanist-Bold.otf" as="font" type="font/otf" crossorigin="anonymous">
  <link rel="icon" type="image/png" href="assets/icon.png">
  <style>
    :root {
      --primary-color: #66bfff;
      --background-dark: #000;
      --text-dark: #fff;
      --collection-bg: #1a1a1a;
      --shadow: 0 2px 4px rgba(255,255,255,0.1);
    }

    @font-face {
      font-family: 'Geomanist-Bold';
      src: url('fonts/Geomanist-Bold.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

body {
  font-family: 'Geomanist-Bold', sans-serif;
  line-height: 1.6;
  margin: 0;
  background: url('https://www.transparenttextures.com/patterns/stardust.png'), #000;
  background-attachment: fixed;
  color: var(--text-dark);
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
      background-color: rgba(26, 26, 26, 0.8);
      border-radius: 15px;
      box-shadow: var(--shadow);
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
  </style>
</head>
<body>
  <header>
    <img src="assets/Header.png" alt="Cryptonauts Leaderboard Header Banner">
  </header>
  
  <main>
    <section class="collection-list">
      <h1>COLLECTIONS</h1>
      <div id="collections"></div>
    </section>
  </main>

  <footer>
    <div class="footer-left">
      <img src="assets/logo.png" alt="Cronobots Logo">
      <p>DEVELOPED BY <a href="https://x.com/Cronos_WTF" target="_blank">UNSCOOP</a></p>
    </div>
    <div class="footer-right">
      <p>LAST UPDATE: ${new Date().toISOString().slice(0, 10)}</p>
    </div>
  </footer>

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

    function renderCollection(collection) {
      try {
        const sortedOwners = [...collection.owners].sort((a, b) => b.count - a.count);
        let currentRank = 1;
        let previousCount = null;
        const rankedOwners = sortedOwners.map((owner, index) => {
          if (index > 0 && owner.count < previousCount) {
            currentRank += 1;
          }
          previousCount = owner.count;
          let rankClass = '';
          if (currentRank === 1) rankClass = 'collection-rank-1';
          else if (currentRank === 2) rankClass = 'collection-rank-2';
          else if (currentRank === 3) rankClass = 'collection-rank-3';
          return { ...owner, rank: currentRank, rankClass };
        });

        const div = document.createElement('div');
        div.className = 'collection';
        div.innerHTML = \`
          <div class="collection-header">
            <img src="\${collection.image}" alt="\${collection.alt}" class="collection-image">
            <div class="title-container">
              <h2>\${collection.title}</h2>
              \${collection.date ? \`<span style="color: #cc8834; font-weight: 700; margin-top: 8px;">\${collection.date}</span>\` : ''}
              \${collection.owners.length ? \`<span class="toggle-btn" data-section-id="\${collection.id}" aria-controls="\${collection.id}" aria-expanded="false" aria-label="Toggle \${collection.title} owners">SHOW OWNERS</span>\` : ''}
            </div>
          </div>
          \${collection.owners.length ? \`
            <div id="\${collection.id}" class="hidden">
              <h3>OWNERS: \${collection.ownersCount}</h3>
              <ul>
                \${rankedOwners.map(owner => \`
                  <li class="\${owner.rankClass}">
                    <div class="left-container">
                      <span class="rank">\${owner.rank}.</span>
                      <a href="\${validateUrl(owner.url)}" target="_blank" rel="noopener noreferrer">\${owner.name}</a>
                      \${owner.twitter ? \`<a href="\${validateTwitterUrl(owner.twitter)}" target="_blank" rel="noopener noreferrer" class="twitter-link">\${getTwitterHandle(owner.twitter)}</a>\` : ''}
                    </div>
                    <span class="count-container"><span class="count-number">\${owner.count}</span><span class="count-text">CRYPTONAUTS</span></span>
                  </li>
                \`).join('')}
              </ul>
            </div>
          \` : ''}
        \`;
        return div;
      } catch (error) {
        console.error(\`Error rendering collection \${collection.title}:\`, error);
        return document.createElement('div');
      }
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
        section.className = 'leaderboard-section';
        section.innerHTML = \`
          <h1>LEADERBOARDS</h1>
          <div class="summary">
            <input type="text" id="searchInput" placeholder="SEARCH OWNER" aria-label="Search owners">
            <ul id="global-owners">
              \${topTenOwners.map(owner => \`
                <li class="\${owner.rankClass}">
                  <div class="left-container">
                    <span class="rank">\${owner.rank}.</span>
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
                      <span class="rank">\${owner.rank}.</span>
                      <a href="\${validateUrl(owner.url)}" target="_blank" rel="noopener noreferrer">\${owner.name}</a>
                      \${owner.twitter ? \`<a href="\${validateTwitterUrl(owner.twitter)}" target="_blank" rel="noopener noreferrer" class="twitter-link">\${getTwitterHandle(owner.twitter)}</a>\` : ''}
                    </div>
                    <span class="count-container"><span class="count-number">\${owner.count}</span><span class="count-text">CRYPTONAUTS</span></span>
                  </li>
                \`).join('')}
              </ul>
            \` : ''}
          </div>
          <img src="assets/Footer.png" alt="Cryptonauts Footer Banner" class="footer-image">
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

    document.addEventListener('DOMContentLoaded', () => {
      try {
        const collectionsContainer = document.getElementById('collections');
        const main = document.querySelector('main');

        if (!collectionsContainer || !main) {
          console.error('Collections container or main element not found');
          return;
        }

        collectionsData.forEach(collection => {
          collection.owners.forEach(owner => {
            owner.url = validateUrl(owner.url);
            owner.twitter = validateTwitterUrl(owner.twitter);
          });
        });

        globalOwnersData.forEach(owner => {
          owner.url = validateUrl(owner.url);
          owner.twitter = validateTwitterUrl(owner.twitter);
        });

        collectionsData.forEach(collection => {
          collectionsContainer.appendChild(renderCollection(collection));
        });

        main.appendChild(renderGlobalOwners(globalOwnersData));

        const toggleButtons = document.querySelectorAll('.toggle-btn');
        toggleButtons.forEach(button => {
          button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section-id');
            const section = document.getElementById(sectionId);
            if (section) {
              const isHidden = section.classList.contains('hidden');
              section.classList.toggle('hidden', !isHidden);
              button.textContent = isHidden ? 'HIDE OWNERS' : 'SHOW OWNERS';
              button.setAttribute('aria-expanded', isHidden);
            }
          });
        });

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
            const filter = searchInput.value.toLowerCase();
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
      } catch (error) {
        console.error('Error in DOMContentLoaded handler:', error);
      }
    });
  </script>
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
