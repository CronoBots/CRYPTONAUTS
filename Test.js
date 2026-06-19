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

// Construit le classement (collections + leaderboard global) et l'écrit dans data.json.
// Test.js ne génère plus index.html : l'index charge data.json en direct via fetch().
function writeCryptonautsData(collectionsData, globalOwnerNFTs, ownersData) {
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

  // Collection externe (Crovia / Cronos) — ajoutée en tête (la plus récente). Données on-chain,
  // owners en adresses (cronoscan) ; volontairement absente de globalOwnersData (leaderboard global).
  allCollectionsData.unshift({"id":"collection-v3","title":"Quantum Cryptonauts V3","image":"assets/v3-logo.jpg","banner":"assets/v3-banner.jpg","alt":"Quantum Cryptonauts V3 COLLECTION ICON","ownersCount":12,"external":"crovia","contract":"0x840d5e2df597ab3dcfed4e5fc883c8d87606748d","croviaUrl":"https://crovia.app/collections/0x840d5e2df597ab3dcfed4e5fc883c8d87606748d","owners":[{"name":"0x2b8b…ae40","count":32,"url":"https://cronoscan.com/address/0x2b8b37dd17fa67833b01e30229502169d1a8ae40"},{"name":"0x1355…884b","count":32,"url":"https://cronoscan.com/address/0x13550dd892ab9cb22b7a6e48d5eba0d2d181884b"},{"name":"0x740c…da0d","count":8,"url":"https://cronoscan.com/address/0x740cd1001bf468e03a2cef898c4ce880f228da0d"},{"name":"0xac96…c1ee","count":8,"url":"https://cronoscan.com/address/0xac96bdcd69f708a5f660425af5d1248aa27fc1ee"},{"name":"0x1833…1048","count":6,"url":"https://cronoscan.com/address/0x183379144e7c8581f24b02b7eedd4e9995bb1048"},{"name":"0xedce…7eae","count":5,"url":"https://cronoscan.com/address/0xedce0151656e82150a0835e9b9cbd1ec53a17eae"},{"name":"0x7886…4c06","count":3,"url":"https://cronoscan.com/address/0x7886acebc8401bd6b1cf397d84b85d01416e4c06"},{"name":"0x64c1…b5c2","count":3,"url":"https://cronoscan.com/address/0x64c15f07ea231789bf5d6f9ecc8089caae46b5c2"},{"name":"0x478f…2c49","count":2,"url":"https://cronoscan.com/address/0x478ffba8ea4945fb9327812231dfb1c6cafd2c49"},{"name":"0x8147…fb06","count":2,"url":"https://cronoscan.com/address/0x8147d4d7578e661004e25ffd3f9fd7bac1f6fb06"},{"name":"0xe6e7…34ed","count":2,"url":"https://cronoscan.com/address/0xe6e7284ddc793fdc15c8cdfbde49a2b7e2b234ed"},{"name":"0x965a…70bd","count":1,"url":"https://cronoscan.com/address/0x965a73574acb12b9b48f3ff43415eea791fd70bd"}]});

  // Prepare globalOwnersData (sans url ni rank : reconstruits/recalculés côté client)
  const globalOwnersData = assignRanks(Object.entries(globalOwnerNFTs)).map(({ name, count }) => {
    const owner = { name, count };
    const tw = ownersData[name]?.twitter;
    if (tw) owner.twitter = tw;
    return owner;
  });

  // Écrit le classement dans data.json (consommé par index.html via fetch).
  const out = { generatedAt: new Date().toISOString(), collectionsData: allCollectionsData, globalOwnersData };
  try {
    fs.writeFileSync('data.json', JSON.stringify(out), 'utf8');
    console.log(`✅ data.json écrit : ${allCollectionsData.length} collections · ${globalOwnersData.length} holders globaux.`);
  } catch (error) {
    console.error('Erreur écriture data.json :', error.message);
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

    // ── AGRÉGATION — Construire ownerNFTs (compatible avec writeCryptonautsData) ──
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
    // REFUSE de réécrire data.json avec des données partielles. On sort en
    // erreur pour que la GitHub Action annule le commit du data.json partiel.
    if (failedCollections.length > 0) {
      console.error(`\n❌ ${failedCollections.length}/${collectionUrls.length} collection(s) en échec (API bloquée / 429 ?). data.json NON modifié pour ne pas publier des données partielles :`);
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
    // on REFUSE de réécrire data.json pour ne pas remplacer le classement par
    // une page vide. On sort en erreur (exit code 1) pour que la GitHub Action
    // annule le commit du data.json partiel.
    if (totalUniqueOwners === 0) {
      console.error('\n❌ Aucun propriétaire récupéré (API bloquée / 403 ?). data.json NON modifié pour ne pas écraser le classement.');
      process.exitCode = 1;
      return;
    }

    // Sauvegarder Owners.json
    saveOwnersJson(ownersData);

    // Écrire le classement dans data.json (consommé par index.html via fetch)
    writeCryptonautsData(collectionsData, globalOwnerNFTs, ownersData);

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
