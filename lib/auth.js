const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

const FILE = path.join(__dirname, '..', 'data', 'admin.json');
const COLLECTION = 'admin';
const DOC_ID = 'main';

function loadLocal() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
}
function saveLocal(a) {
  fs.writeFileSync(FILE, JSON.stringify(a, null, 2));
}

// Creates the admin record on first run (using ADMIN_PASSWORD/RESET_EMAIL from
// the environment) and returns it on every subsequent call. Backed by MongoDB
// when MONGODB_URI is set, otherwise by a local JSON file.
async function ensureAdmin() {
  const db = await getDb();
  if (!db) {
    let a = loadLocal();
    if (!a) {
      a = { passwordHash: bcrypt.hashSync(requireEnv('ADMIN_PASSWORD'), 12), resetEmail: requireEnv('RESET_EMAIL') };
      saveLocal(a);
    }
    return a;
  }
  let doc = await db.collection(COLLECTION).findOne({ _id: DOC_ID });
  if (!doc) {
    doc = { _id: DOC_ID, passwordHash: bcrypt.hashSync(requireEnv('ADMIN_PASSWORD'), 12), resetEmail: requireEnv('RESET_EMAIL') };
    await db.collection(COLLECTION).insertOne(doc);
  }
  return doc;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function verify(password) {
  const a = await ensureAdmin();
  return bcrypt.compare(password, a.passwordHash);
}

async function changePassword(password) {
  const passwordHash = bcrypt.hashSync(password, 12);
  const db = await getDb();
  if (!db) {
    const a = await ensureAdmin();
    a.passwordHash = passwordHash;
    saveLocal(a);
    return;
  }
  await db.collection(COLLECTION).updateOne({ _id: DOC_ID }, { $set: { passwordHash } }, { upsert: true });
}

async function getResetEmail() {
  const a = await ensureAdmin();
  return a.resetEmail;
}

module.exports = { ensureAdmin, verify, changePassword, getResetEmail };
