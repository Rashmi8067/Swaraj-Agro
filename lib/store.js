const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

const DATA_FILE = path.join(__dirname, '..', 'data', 'site.json');
const COLLECTION = 'site';
const DOC_ID = 'main';
const CATALOG_SEED_VERSION = 2;
const defaultProducts = require('./default-products');

function readLocal() {
  if (!fs.existsSync(DATA_FILE)) throw new Error('Missing data/site.json');
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function normalize(data) {
  data = data || {};
  data.company = data.company || {};
  data.company.phones = Array.isArray(data.company.phones) ? data.company.phones : (data.company.phone ? [data.company.phone] : []);
  data.company.name = data.company.name || 'Swaraj Agro';
  data.company.googleMapsUrl = data.company.googleMapsUrl || '';
  data.branches = Array.isArray(data.branches) ? data.branches : [];
  data.products = Array.isArray(data.products) ? data.products : [];
  data.photos = Array.isArray(data.photos) ? data.photos : [];
  for (const photo of data.photos) { photo.homeFeatured = Boolean(photo.homeFeatured); photo.category = photo.category || 'Other'; }
  for (const p of data.products) {
    p.category = p.category === 'Solar Solution' || p.category === 'Farm Machinery' ? p.category : 'Farm Machinery';
    p.subcategory = p.subcategory || ''; p.price = p.price || 'Contact for Price'; p.description = p.description || '';
    p.soldQuantity = Math.max(0, Number(p.soldQuantity) || 0); p.featured = Boolean(p.featured);
  }
  return data;
}

function writeLocal(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// Reads site data from MongoDB if MONGODB_URI is configured, otherwise from the
// local JSON file. On first run against a fresh database, seeds it from the
// local data/site.json so existing content isn't lost.
async function read() {
  const db = await getDb();
  if (!db) return normalize(readLocal());
  const doc = await db.collection(COLLECTION).findOne({ _id: DOC_ID });
  if (doc) {
    const { _id, ...data } = doc;
    const normalized = normalize(data);
    // Add the supplied standard catalog to an existing MongoDB site once.
    // Existing products are preserved; only catalog entries with new IDs are added.
    if ((Number(normalized.productCatalogSeedVersion) || 0) < CATALOG_SEED_VERSION) {
      const existingIds = new Set(normalized.products.map(p => p.id));
      const additions = defaultProducts.filter(p => !existingIds.has(p.id));
      normalized.products.push(...additions);
      const defaultsById = new Map(defaultProducts.map(p => [p.id, p]));
      for (const product of normalized.products) {
        const supplied = defaultsById.get(product.id);
        if (supplied && !product.image && supplied.image) product.image = supplied.image;
        if (supplied && (!product.description || product.description.includes('Brand:'))) {
          product.description = supplied.description;
        }
        if (supplied && supplied.brand && !product.brand) product.brand = supplied.brand;
      }
      normalized.productCatalogSeedVersion = CATALOG_SEED_VERSION;
      await db.collection(COLLECTION).replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ...normalized }, { upsert: true });
    }
    return normalized;
  }
  if (!fs.existsSync(DATA_FILE)) throw new Error('No site data found to seed the database. Missing data/site.json.');
  const seed = readLocal();
  await db.collection(COLLECTION).insertOne({ _id: DOC_ID, ...seed });
  return normalize(seed);
}

async function write(data) {
  const db = await getDb();
  if (!db) return writeLocal(data);
  await db.collection(COLLECTION).replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ...data }, { upsert: true });
}

async function update(mutator) {
  const d = normalize(await read());
  mutator(d);
  await write(d);
  return d;
}

module.exports = { read, write, update };
