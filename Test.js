// Récupération des propriétaires alignée EXACTEMENT sur le panel « Snapshot » v3.9.8
// d'index.html. Owner resolution via :
//   Phase B  — assets(collectionId) paginé (pages en parallèle)
//   Phase C  — eventHistory(naturesIn:['transferred']) : owner courant par ÉDITION
//   Phase C-fallback — editions(assetId:) BATCHÉES en aliasing (1 HTTP = N requêtes)
//                      → ~10× moins de requêtes = plus de 429
//   Secondary — editionEvents(editionId) pour les NFT retirés (withdrawn)
//   Phase E  — agrégation : 1 count / édition, holder keyé par uuid||username
// Plus de limiteur de débit global : on s'appuie sur la concurrence bornée +
// retry/backoff, comme le fait le snapshot dans le navigateur (IP résidentielle).
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

// Générer les URLs des collections à traiter (uniquement celles avec process: true).
// SNAP_ONLY=<id> (ou nom partiel) permet de ne traiter qu'une collection (debug/test).
const _only = (process.env.SNAP_ONLY || '').trim().toLowerCase();
const collectionUrls = collections
  .filter(collection => collection.process)
  .filter(collection => !_only || collection.id.toLowerCase().includes(_only) || collection.name.toLowerCase().includes(_only))
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
// GraphQL — endpoint + config (alignés sur le panel Snapshot v3.9.8 d'index.html)
// ─────────────────────────────────────────────────────────────────────────────
const GQL_ENDPOINT = 'https://crypto.com/nft-api/graphql';

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
};

// Tunables — calqués sur SNAP_CONF (v3.9.8). Le modèle de coût de l'API plafonne
// à 250/requête, ~17 par alias → 10 alias × first=1 ≈ 170 (sûr), 5 × first=100 ≈ 135.
const SNAP_CONF = {
  ASSET_PAGE_SIZE:                 100,  // assets() page size (max API)
  ASSET_PAGE_CONCURRENCY:            3,  // pages assets() en parallèle
  HISTORY_PAGE_SIZE:               100,  // eventHistory page size (séquentiel)
  HISTORY_MAX_CONSECUTIVE_FAILS:     5,  // abandon après N échecs d'affilée
  RETRY_BASE_MS:                   500,  // backoff exponentiel de base
  RETRY_MAX_ATTEMPTS:                7,  // 0.5,1,2,4,8,16,30s (anti-429 résilient)
  RETRY_MAX_MS:                  30000,  // plafond du backoff
  PHASE_B_EMPTY_WAVE_LIMIT:          3,  // stop pagination spéculative après N vagues vides
  FALLBACK_BATCH_SIZE_SINGLE:       10,  // alias/HTTP pour single-edition (first=1)
  FALLBACK_BATCH_SIZE_MULTI:         5,  // alias/HTTP pour multi-edition  (first=100)
  FALLBACK_BATCH_CONCURRENCY:        2,  // batches de fallback en parallèle
  FALLBACK_INTER_BATCH_DELAY_MS:    50,  // petit délai entre batches
  SECONDARY_FALLBACK_CAP:           50,  // max assets retentés via editionEvents
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// Découpe un tableau en morceaux de n
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── Queries (copiées du module Snapshot v3.9.8) ──────────────────────────────
const Q_COLLECTION_INFO = `query GetCollection($collectionId:ID!,$cacheId:ID){
  public(cacheId:$cacheId){collection(id:$collectionId){
    id name verified
    metrics{ items }
  }}}`;

const Q_COLLECTION_METRIC = `query GetCollectionMetric($collectionId:ID!,$cacheId:ID){
  public(cacheId:$cacheId){collectionMetric(id:$collectionId){
    totalSupply totalSalesCount owners
  }}}`;

const Q_ALL_ASSETS = `query GetCollectionAssets($collectionId:ID,$first:Int!,$skip:Int!,$cacheId:ID){
  public(cacheId:$cacheId){assets(collectionId:$collectionId,first:$first,skip:$skip){
    id name copies copiesInCirculation
    offerableEditionId
    defaultListingV2{ editionId }
    latestPurchasedEdition{ id }
  }}}`;

const Q_HISTORY = `query getCollectionEventHistory($collectionId:ID!,$first:Int!,$after:String,$naturesIn:[String!],$cacheId:ID){
  public(cacheId:$cacheId){collection(id:$collectionId){id eventHistory(first:$first,after:$after,naturesIn:$naturesIn){
    edges{node{nature createdAt
      asset{id}
      edition{index}
      toUser{uuid username displayName verified isCreator}
      user{uuid username displayName verified isCreator}
    }}
    pageInfo{endCursor hasNextPage}
  }}}}`;

const Q_EDITION_EVENTS = `query EditionEvents($editionId:ID!,$cacheId:ID){
  public(cacheId:$cacheId){editionEvents(editionId:$editionId){
    nature createdAt
    toUser{uuid username displayName verified isCreator}
    user{uuid username displayName verified isCreator}
  }}}`;

// Seul 'transferred' est accepté comme filtre naturesIn par l'API (vérifié
// empiriquement). Chaque acquisition produit un event 'transferred' → couvre
// tous les changements de propriétaire. Les mints jamais transférés sont
// récupérés par le fallback editions(assetId:).
const TRANSFER_NATURES = ['transferred'];

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

// ── Couche réseau ────────────────────────────────────────────────────────────
const _silentErrorsSeen = new Set();

// POST GraphQL unique avec retry sur erreurs transitoires (réseau / 429 / 403 /
// 5xx). Les erreurs GraphQL *logiques* (errors && !data) ne sont pas retentées.
// Les erreurs partielles (errors && data) sont loggées une fois puis on renvoie data.
async function gql(operationName, variables, query) {
  let lastErr;
  for (let attempt = 0; attempt < SNAP_CONF.RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await axios.post(GQL_ENDPOINT,
        { operationName, variables: variables || {}, query },
        { timeout: 20000, headers: HTTP_HEADERS });
      const json = res.data;
      if (json.errors && !json.data) {
        const e = new Error(json.errors[0]?.message || 'GraphQL error (no data)');
        e.graphqlLogic = true;
        throw e;
      }
      if (json.errors && json.data && !_silentErrorsSeen.has(operationName)) {
        _silentErrorsSeen.add(operationName);
        console.warn(`[gql] ${operationName} partial errors:`, json.errors.slice(0, 3).map(e => e.message).join(' | '));
      }
      return json.data;
    } catch (e) {
      lastErr = e;
      if (e.graphqlLogic) throw e; // non-retryable
      if (attempt < SNAP_CONF.RETRY_MAX_ATTEMPTS - 1) {
        const backoff = Math.min(SNAP_CONF.RETRY_MAX_MS, SNAP_CONF.RETRY_BASE_MS * Math.pow(2, attempt));
        await sleep(backoff + Math.floor(Math.random() * 400));
      }
    }
  }
  throw lastErr;
}

// editions(assetId:) BATCHÉES via fragments aliasés : 1 HTTP = N requêtes.
// Amortit le surcoût de coût (~17/alias) → ~10× moins de round-trips = anti-429.
// Les assetId sont validés en hex avant interpolation (anti-injection).
const HEX_RE = /^[0-9a-fA-F]+$/;
async function gqlBatchEditions(assetIds, opts = {}) {
  const first = opts.first || 1;
  const skip = Number.isInteger(opts.skip) ? opts.skip : 0;
  assetIds.forEach(id => {
    if (typeof id !== 'string' || id.length > 64 || !HEX_RE.test(id)) {
      throw new Error(`Bad assetId in batch: ${id}`);
    }
  });
  const fragments = assetIds.map((id, i) =>
`a${i}: public {
  editions(assetId: "${id}", first: ${first}, skip: ${skip}, isDropLast: false) {
    totalCount
    editions {
      id index
      owner { uuid username displayName verified isCreator }
      ownership { primary }
    }
  }
}`).join('\n');
  const query = `query SnapBatchEditions {\n${fragments}\n}`;

  let lastErr;
  for (let attempt = 0; attempt < SNAP_CONF.RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await axios.post(GQL_ENDPOINT, { operationName: 'SnapBatchEditions', query },
        { timeout: 20000, headers: HTTP_HEADERS });
      const json = res.data;
      if (json.errors && !json.data) throw new Error('GraphQL: ' + (json.errors[0]?.message || 'no data'));
      if (json.errors && json.errors.length && !_silentErrorsSeen.has('SnapBatchEditions')) {
        _silentErrorsSeen.add('SnapBatchEditions');
        console.warn('[gqlBatchEditions] partial errors:', json.errors.slice(0, 3).map(e => e.message).join(' | '));
      }
      const out = {};
      assetIds.forEach((id, i) => { out[id] = json.data?.[`a${i}`]?.editions || null; });
      return out;
    } catch (e) {
      lastErr = e;
      if (attempt < SNAP_CONF.RETRY_MAX_ATTEMPTS - 1) {
        const backoff = Math.min(SNAP_CONF.RETRY_MAX_MS, SNAP_CONF.RETRY_BASE_MS * Math.pow(2, attempt));
        await sleep(backoff + Math.floor(Math.random() * 400));
      }
    }
  }
  throw lastErr;
}

// Fonction pour récupérer le twitterUsername via une requête GraphQL directe
async function getTwitterUsername(username) {
  let twitterUsername = null;
  let retries = 3;
  let delayMs = 1000;
  while (retries > 0 && !twitterUsername) {
    try {
      const response = await axios.post(GQL_ENDPOINT, {
        query: profileQuery,
        variables: { id: username, cacheId: `getUserQuery-Profile-${username}` }
      }, { timeout: 10000, headers: HTTP_HEADERS });
      const result = response.data;
      if (result.errors) throw new Error(`GraphQL Error: ${result.errors.map(e => e.message).join(', ')}`);
      const userData = result.data?.public?.user;
      if (userData?.twitterUsername) twitterUsername = userData.twitterUsername.replace(/^@/, '');
      retries = 0;
    } catch (error) {
      retries--;
      if (retries > 0) { await sleep(delayMs); delayMs *= 2; }
    }
  }
  return twitterUsername ? `https://x.com/${twitterUsername}` : '';
}

// ── Phase C — parcours eventHistory (séquentiel, cursor) ─────────────────────
// Dérive l'owner courant par ÉDITION (asset.id × edition.index). Events en
// newest-first → le 1er event vu pour une édition = état courant.
async function walkOwnersAndDates(collectionId) {
  const currentOwnerKey = {};      // "assetId|index" → déjà vu ?
  const realEditionsPerAsset = {}; // assetId → [{ id, index, owner, ownership }]
  let cursor = null, hasMore = true;
  let eventCount = 0, pages = 0, pageFailures = 0, consecutiveFailures = 0;
  const pageErrorMsgs = [];

  while (hasMore) {
    pages++;
    let data;
    try {
      data = await gql('getCollectionEventHistory',
        { collectionId, first: SNAP_CONF.HISTORY_PAGE_SIZE, after: cursor || null, naturesIn: TRANSFER_NATURES, cacheId: 'snap-hist-' + collectionId + '-' + (cursor || 'head') },
        Q_HISTORY);
      consecutiveFailures = 0;
    } catch (e) {
      pageFailures++;
      consecutiveFailures++;
      if (pageErrorMsgs.length < 3) pageErrorMsgs.push(e.message);
      if (consecutiveFailures >= SNAP_CONF.HISTORY_MAX_CONSECUTIVE_FAILS) {
        throw new Error(`Event history walk aborted: ${consecutiveFailures} consecutive page failures. Last error: ${pageErrorMsgs[0] || 'unknown'}`);
      }
      await sleep(500);
      continue;
    }

    const hist = data?.public?.collection?.eventHistory;
    if (!hist) break;

    hist.edges.forEach(({ node }) => {
      if (!node) return;
      const aid = node.asset?.id;
      if (!aid) return;
      const idx = node.edition?.index ?? 1;
      const key = `${aid}|${idx}`;
      const nature = node.nature || 'unknown';

      let owner = null;
      if (node.toUser?.username) owner = node.toUser;
      else if (nature === 'withdrawn' && node.user?.username) owner = node.user;

      if (!currentOwnerKey[key] && owner) {
        currentOwnerKey[key] = true;
        if (!realEditionsPerAsset[aid]) realEditionsPerAsset[aid] = [];
        realEditionsPerAsset[aid].push({ id: null, index: idx, owner, ownership: { primary: false } });
      }
      eventCount++;
    });

    cursor = hist.pageInfo.endCursor;
    hasMore = hist.pageInfo.hasNextPage;
  }

  return { realEditionsPerAsset, eventCount, pages, pageFailures };
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
  allCollectionsData.unshift({"id":"collection-v3","title":"Quantum Cryptonauts V3","image":"assets/v3-logo.jpg?v=2","banner":"assets/v3-banner.jpg?v=2","alt":"Quantum Cryptonauts V3 COLLECTION ICON","ownersCount":12,"external":"crovia","contract":"0x840d5e2df597ab3dcfed4e5fc883c8d87606748d","croviaUrl":"https://crovia.app/collections/0x840d5e2df597ab3dcfed4e5fc883c8d87606748d","owners":[{"name":"0x2b8b…ae40","count":32,"url":"https://cronoscan.com/address/0x2b8b37dd17fa67833b01e30229502169d1a8ae40"},{"name":"0x1355…884b","count":32,"url":"https://cronoscan.com/address/0x13550dd892ab9cb22b7a6e48d5eba0d2d181884b"},{"name":"0x740c…da0d","count":8,"url":"https://cronoscan.com/address/0x740cd1001bf468e03a2cef898c4ce880f228da0d"},{"name":"0xac96…c1ee","count":8,"url":"https://cronoscan.com/address/0xac96bdcd69f708a5f660425af5d1248aa27fc1ee"},{"name":"0x1833…1048","count":6,"url":"https://cronoscan.com/address/0x183379144e7c8581f24b02b7eedd4e9995bb1048"},{"name":"0xedce…7eae","count":5,"url":"https://cronoscan.com/address/0xedce0151656e82150a0835e9b9cbd1ec53a17eae"},{"name":"0x7886…4c06","count":3,"url":"https://cronoscan.com/address/0x7886acebc8401bd6b1cf397d84b85d01416e4c06"},{"name":"0x64c1…b5c2","count":3,"url":"https://cronoscan.com/address/0x64c15f07ea231789bf5d6f9ecc8089caae46b5c2"},{"name":"0x478f…2c49","count":2,"url":"https://cronoscan.com/address/0x478ffba8ea4945fb9327812231dfb1c6cafd2c49"},{"name":"0x8147…fb06","count":2,"url":"https://cronoscan.com/address/0x8147d4d7578e661004e25ffd3f9fd7bac1f6fb06"},{"name":"0xe6e7…34ed","count":2,"url":"https://cronoscan.com/address/0xe6e7284ddc793fdc15c8cdfbde49a2b7e2b234ed"},{"name":"0x965a…70bd","count":1,"url":"https://cronoscan.com/address/0x965a73574acb12b9b48f3ff43415eea791fd70bd"}]});

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
// processCollection — port fidèle du runSnapshot(collectionId) v3.9.8
// ─────────────────────────────────────────────────────────────────────────────
async function processCollection(collectionUrl, usePagination, globalOwnerNFTs, collectionsData, ownersData) {
  const collectionId = collectionUrl.split('/').pop();
  let collectionName = '';

  try {
    // ── PHASE A — Infos collection (nom + métriques officielles) ──────────────
    let officialItems = 0;
    let officialOwners = 0;
    try {
      const [info, metric] = await Promise.all([
        gql('GetCollection', { collectionId, cacheId: 'snap-col-' + collectionId }, Q_COLLECTION_INFO),
        gql('GetCollectionMetric', { collectionId, cacheId: 'snap-metric-' + collectionId }, Q_COLLECTION_METRIC).catch(() => null)
      ]);
      const c = info?.public?.collection;
      if (c) collectionName = c.name || '';
      const items = Number(c?.metrics?.items) || 0;
      const totalSupply = Number(metric?.public?.collectionMetric?.totalSupply) || 0;
      officialItems = Math.max(items, totalSupply);
      officialOwners = Number(metric?.public?.collectionMetric?.owners) || 0;
    } catch (e) {
      console.warn(`Could not fetch collection info: ${e.message}`);
    }
    if (!collectionName) throw new Error(`Failed to retrieve collection name for ${collectionId}`);

    console.log('\nCOLLECTION:');
    console.log(`- ${collectionName}`);
    console.log(`- Total Supply (official): ${officialItems}`);
    console.log(`- Owners (official): ${officialOwners}\n`);

    // ── PHASE B — Tous les assets (pages en parallèle) ────────────────────────
    const allAssets = [];
    {
      console.log('Phase B — Fetching all collection assets…');
      const hint = officialItems;
      if (hint > 0) {
        const pageCount = Math.ceil(hint / SNAP_CONF.ASSET_PAGE_SIZE);
        const pages = Array.from({ length: pageCount }, (_, i) => i);
        await mapPool(pages, SNAP_CONF.ASSET_PAGE_CONCURRENCY, async (i) => {
          const d = await gql('GetCollectionAssets',
            { collectionId, first: SNAP_CONF.ASSET_PAGE_SIZE, skip: i * SNAP_CONF.ASSET_PAGE_SIZE, cacheId: 'snap-assets-' + collectionId + '-' + i },
            Q_ALL_ASSETS);
          (d?.public?.assets || []).forEach(a => allAssets.push(a));
        });
        // Sonde de sécurité : s'il manque des assets, on pagine au-delà.
        let skip = allAssets.length;
        let safety = 0;
        while (allAssets.length < hint && safety < 50) {
          safety++;
          const d = await gql('GetCollectionAssets',
            { collectionId, first: SNAP_CONF.ASSET_PAGE_SIZE, skip, cacheId: 'snap-assets-' + collectionId + '-probe' + safety },
            Q_ALL_ASSETS);
          const batch = d?.public?.assets || [];
          if (batch.length === 0) break;
          batch.forEach(a => allAssets.push(a));
          skip += batch.length;
          if (batch.length < SNAP_CONF.ASSET_PAGE_SIZE) break;
        }
      } else {
        // Pas de hint : pagination spéculative par vagues jusqu'à vagues vides.
        let skip = 0, emptyWaves = 0, ended = false;
        while (!ended && emptyWaves < SNAP_CONF.PHASE_B_EMPTY_WAVE_LIMIT) {
          const wave = Array.from({ length: SNAP_CONF.ASSET_PAGE_CONCURRENCY }, (_, k) => skip + k * SNAP_CONF.ASSET_PAGE_SIZE);
          const before = allAssets.length;
          await mapPool(wave, SNAP_CONF.ASSET_PAGE_CONCURRENCY, async (s) => {
            const d = await gql('GetCollectionAssets',
              { collectionId, first: SNAP_CONF.ASSET_PAGE_SIZE, skip: s, cacheId: 'snap-assets-' + collectionId + '-' + s },
              Q_ALL_ASSETS);
            const batch = d?.public?.assets || [];
            batch.forEach(a => allAssets.push(a));
            if (batch.length < SNAP_CONF.ASSET_PAGE_SIZE) ended = true;
          });
          if (allAssets.length === before) emptyWaves++; else emptyWaves = 0;
          skip += SNAP_CONF.ASSET_PAGE_CONCURRENCY * SNAP_CONF.ASSET_PAGE_SIZE;
        }
      }
      // Dédup (les pages parallèles peuvent se recouvrir sur la sonde)
      const seen = new Set();
      for (let i = allAssets.length - 1; i >= 0; i--) {
        if (seen.has(allAssets[i].id)) allAssets.splice(i, 1);
        else seen.add(allAssets[i].id);
      }
      const minted = allAssets.reduce((s, a) => s + (a.copiesInCirculation != null ? a.copiesInCirculation : (a.copies || 1)), 0);
      console.log(`  ✓ Phase B: ${allAssets.length} assets · ${minted} éditions mintées.`);
    }

    // ── PHASE C — Owner courant par édition via eventHistory ──────────────────
    console.log('Phase C — Walking event history…');
    const phaseC = await walkOwnersAndDates(collectionId);
    const realEditionsPerAsset = phaseC.realEditionsPerAsset;
    console.log(`  ✓ Phase C: ${phaseC.eventCount} events · ${phaseC.pages} pages · ${Object.keys(realEditionsPerAsset).length} assets résolus${phaseC.pageFailures ? ` · ${phaseC.pageFailures} échecs page` : ''}.`);

    // ── PHASE C-fallback — editions(assetId:) batchées pour les manquants ─────
    const phantomAssetIds = new Set();
    {
      const assetsZero = [], assetsPartial = [];
      allAssets.forEach(a => {
        const got = realEditionsPerAsset[a.id]?.length || 0;
        const minted = a.copiesInCirculation != null ? a.copiesInCirculation : (a.copies || 1);
        if (minted === 0) return;
        if (got >= minted) return;
        if (got > 0) assetsPartial.push(a); else assetsZero.push(a);
      });
      const needFallback = [...assetsZero, ...assetsPartial];

      // Fusion par index d'édition (les résultats frais écrasent ceux de Phase C)
      const mergeEditions = (assetId, fresh) => {
        const byIndex = new Map();
        (realEditionsPerAsset[assetId] || []).forEach(ed => { if (ed.index != null) byIndex.set(ed.index, ed); });
        fresh.forEach(ed => { if (ed.index != null) byIndex.set(ed.index, ed); });
        realEditionsPerAsset[assetId] = Array.from(byIndex.values());
      };
      const totalCountPerAsset = {};

      if (needFallback.length > 0) {
        console.log(`Phase C-fallback — ${needFallback.length} assets (${assetsZero.length} zéro · ${assetsPartial.length} partiels). Batched aliased…`);
        const single = needFallback.filter(a => (a.copies || 1) === 1);
        const multi = needFallback.filter(a => (a.copies || 1) > 1);

        const runTier = async (assets, batchSize, first) => {
          const batches = chunk(assets.map(a => a.id), batchSize);
          await mapPool(batches, SNAP_CONF.FALLBACK_BATCH_CONCURRENCY, async (ids) => {
            const result = await gqlBatchEditions(ids, { first });
            ids.forEach(id => {
              const r = result[id];
              if (!r) return;
              totalCountPerAsset[id] = r.totalCount || 0;
              const eds = r.editions || [];
              if ((r.totalCount || 0) > 0 && eds.length === 0) { phantomAssetIds.add(id); return; }
              if (eds.length > 0) {
                mergeEditions(id, eds.map(ed => ({ id: ed.id, index: ed.index, owner: ed.owner, ownership: ed.ownership || { primary: false } })));
              }
            });
            if (SNAP_CONF.FALLBACK_INTER_BATCH_DELAY_MS > 0) await sleep(SNAP_CONF.FALLBACK_INTER_BATCH_DELAY_MS);
          });
        };

        await runTier(single, SNAP_CONF.FALLBACK_BATCH_SIZE_SINGLE, 1);
        await runTier(multi, SNAP_CONF.FALLBACK_BATCH_SIZE_MULTI, 100);

        // Débordement pour les multi-éditions à >100 éditions
        for (const a of multi) {
          const tc = totalCountPerAsset[a.id] || 0;
          if (tc > 100) {
            let skip = 100;
            while (skip < tc && skip < 5000) {
              const r = await gqlBatchEditions([a.id], { first: 100, skip });
              const eds = r[a.id]?.editions || [];
              if (eds.length === 0) break;
              mergeEditions(a.id, eds.map(ed => ({ id: ed.id, index: ed.index, owner: ed.owner, ownership: ed.ownership || { primary: false } })));
              skip += 100;
              await sleep(SNAP_CONF.FALLBACK_INTER_BATCH_DELAY_MS);
            }
          }
        }

        // ── Secondary — editionEvents pour les assets toujours vides (withdrawn) ──
        const stillMissing = needFallback.filter(a => !realEditionsPerAsset[a.id]?.length && !phantomAssetIds.has(a.id));
        if (stillMissing.length > 0 && stillMissing.length <= SNAP_CONF.SECONDARY_FALLBACK_CAP) {
          console.log(`Phase C-fallback (secondary) — ${stillMissing.length} assets via editionEvents…`);
          for (const a of stillMissing) {
            const edId = a.latestPurchasedEdition?.id || a.offerableEditionId || a.defaultListingV2?.editionId;
            if (!edId) continue;
            try {
              const d = await gql('EditionEvents', { editionId: edId, cacheId: 'snap-ee-' + edId }, Q_EDITION_EVENTS);
              const events = d?.public?.editionEvents || [];
              let owner = null;
              for (const ev of events) {
                if (ev.toUser?.username) { owner = ev.toUser; break; }
                else if (ev.nature === 'withdrawn' && ev.user?.username) { owner = ev.user; break; }
              }
              if (owner) realEditionsPerAsset[a.id] = [{ id: edId, index: 1, owner, ownership: { primary: false } }];
              await sleep(80);
            } catch (e) { /* on continue */ }
          }
        }
      }
    }

    // ── Filtre fantômes (totalCount>0 mais editions:[]) ───────────────────────
    if (phantomAssetIds.size > 0) {
      const before = allAssets.length;
      for (let i = allAssets.length - 1; i >= 0; i--) {
        if (phantomAssetIds.has(allAssets[i].id)) allAssets.splice(i, 1);
      }
      console.log(`  ✓ Filtre fantômes : ${phantomAssetIds.size} assets buggés exclus (${before} → ${allAssets.length}).`);
    }

    // ── PHASE E — Agrégation : 1 count / édition, holder keyé par uuid||username ──
    const holderMap = {};
    let totalAttributed = 0;
    const upsertHolder = (own) => {
      if (!own?.username) return;
      const k = own.uuid || own.username;
      if (!holderMap[k]) {
        holderMap[k] = { username: own.username, uuid: k, count: 0 };
      }
      holderMap[k].count += 1;
    };
    allAssets.forEach(a => {
      const eds = realEditionsPerAsset[a.id] || [];
      eds.forEach(ed => {
        if (ed?.owner?.username) { upsertHolder(ed.owner); totalAttributed++; }
      });
    });

    // ── Conversion vers ownerNFTs (username→count) + contribution au global ──
    const ownerNFTs = {};
    Object.values(holderMap).forEach(h => {
      ownerNFTs[h.username] = (ownerNFTs[h.username] || 0) + h.count;
      globalOwnerNFTs[h.username] = (globalOwnerNFTs[h.username] || 0) + h.count;
    });

    // ── Récupérer les liens Twitter/X pour les nouveaux propriétaires ──
    const newOwners = Object.keys(ownerNFTs).filter(o => !(o in ownersData));
    if (newOwners.length > 0) {
      console.log(`Fetching Twitter usernames for ${newOwners.length} new owner${newOwners.length === 1 ? '' : 's'}…`);
      await mapPool(newOwners, 4, async (owner) => {
        const twitterUrl = await getTwitterUsername(owner);
        ownersData[owner] = { username: owner, twitter: twitterUrl };
      });
      saveOwnersJson(ownersData);
    }

    // ── Logs de discrepancy ──
    const scrapedOwnersCount = Object.keys(ownerNFTs).length;
    if (officialItems > 0 && totalAttributed !== officialItems) {
      console.warn(`Discrepancy detected for collection ${collectionName}: Scraped ${totalAttributed} editions, but expected ${officialItems}.`);
    }
    if (officialOwners > 0 && scrapedOwnersCount !== officialOwners) {
      console.warn(`Discrepancy in owner count for collection ${collectionName}: Scraped ${scrapedOwnersCount} owners, but expected ${officialOwners}.`);
    }

    collectionsData.push({
      collectionId,
      collectionName,
      totalSupply: officialItems > 0 ? officialItems : totalAttributed,
      owners: officialOwners > 0 ? officialOwners : scrapedOwnersCount,
      ownerNFTs
    });

    console.log(`✅ ${collectionName}: ${scrapedOwnersCount} unique owners · ${totalAttributed} editions counted.`);
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
    const ownersData = loadOwnersJson();
    const globalOwnerNFTs = {};
    const collectionsData = [];

    const failedCollections = [];
    for (const { url, usePagination } of collectionUrls) {
      console.log(`\n=== Processing collection: ${url} ===`);
      const r = await processCollection(url, usePagination, globalOwnerNFTs, collectionsData, ownersData);
      if (!r.ok) failedCollections.push(url);
      await delay(3000); // courte pause entre collections (le batching réduit déjà fortement le débit)
    }

    // ── GARDE-FOU n°1 : échec d'au moins une collection ──
    if (failedCollections.length > 0) {
      console.error(`\n❌ ${failedCollections.length}/${collectionUrls.length} collection(s) en échec (API bloquée / 429 ?). data.json NON modifié pour ne pas publier des données partielles :`);
      failedCollections.forEach(u => console.error(`   - ${u}`));
      process.exitCode = 1;
      return;
    }

    const totalUniqueOwners = Object.keys(globalOwnerNFTs).length;
    const totalCryptonautsAcrossAllCollections = collectionsData.reduce((sum, data) => sum + data.totalSupply, 0);

    console.log('\n=== Global Summary ===');
    console.log(`Total Unique Owners: ${totalUniqueOwners}`);
    console.log(`Total Cryptonauts Across All Collections: ${totalCryptonautsAcrossAllCollections}\n`);

    // ── GARDE-FOU n°2 : aucune donnée du tout ──
    if (totalUniqueOwners === 0) {
      console.error('\n❌ Aucun propriétaire récupéré (API bloquée / 403 ?). data.json NON modifié pour ne pas écraser le classement.');
      process.exitCode = 1;
      return;
    }

    saveOwnersJson(ownersData);
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
