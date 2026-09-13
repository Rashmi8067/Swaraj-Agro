require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const { v2: cloudinary } = require('cloudinary');
const seed = require('./seed-data.json');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'stockflow';
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_DIR = __dirname;

if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Missing MONGODB_URI or JWT_SECRET environment variable.');
  process.exit(1);
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(require('helmet')({ contentSecurityPolicy: false }));
app.use(express.static(CLIENT_DIR, { index: 'index.html' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

let client;
let db;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalizeWorkspace(workspace) {
  const result = clone(workspace);
  delete result.passwords;
  delete result.staffUsers;
  result.activeCompany = result.activeCompany || 'machinery';
  return result;
}

function buildSeedWorkspace() {
  const main = clone(seed.defaultData);
  const companies = {
    machinery: { name: 'Swaraj Agro – Farm Machinery', symbol: 'F', description: 'Farm machinery & agricultural equipment', products: clone(main.products), accounts: clone(main.accounts), transactions: clone(main.transactions) },
    solar: clone(seed.shopSeeds.solar),
    service: clone(seed.shopSeeds.service)
  };
  for (const company of Object.values(companies)) {
    const inv = company.accounts.find(a => a.type === 'Asset' || a.name.toLowerCase().includes('inventory'));
    if (inv) inv.balance = company.products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0);
  }
  return normalizeWorkspace({ companies, activeCompany: 'machinery', seedVersion: seed.seedVersion || 3 });
}

async function ensureWorkspace() {
  const collection = db.collection('workspaces');
  let workspace = await collection.findOne({ key: 'default' });
  const targetVersion = Number(seed.seedVersion || 3);
  if (!workspace) {
    const now = new Date();
    workspace = { key: 'default', ...buildSeedWorkspace(), createdAt: now, updatedAt: now };
    await collection.insertOne(workspace);
  } else if (Number(workspace.seedVersion || 0) < targetVersion) {
    // One-time reset for the demo workspace after the Swaraj Agro conversion.
    // This intentionally replaces only the StockFlow workspace seed data; user accounts remain intact.
    const replacement = buildSeedWorkspace();
    workspace = { ...workspace, ...replacement, updatedAt: new Date() };
    await collection.replaceOne({ key: 'default' }, workspace);
  }
  return workspace;
}

async function ensureUser(email, password, profile) {
  const users = db.collection('users');
  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const user = {
    ...profile,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now
  };
  await users.insertOne(user);
  return user;
}

async function ensureUsers() {
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const staffPassword = process.env.INITIAL_STAFF_PASSWORD;
  const warehousePassword = process.env.INITIAL_WAREHOUSE_PASSWORD;
  if (!adminPassword || !staffPassword || !warehousePassword) {
    console.error('Missing INITIAL_ADMIN_PASSWORD, INITIAL_STAFF_PASSWORD, or INITIAL_WAREHOUSE_PASSWORD.');
    process.exit(1);
  }
  await ensureUser(process.env.INITIAL_ADMIN_EMAIL || 'admin@swarajagro.com', adminPassword, {
    userId: 'admin', name: 'Swaraj Agro Admin', initials: 'SA', role: 'Administrator', isAdmin: true,
    permissions: { viewAmounts: true, recordSales: true, recordPurchases: true }
  });
  await ensureUser(process.env.INITIAL_STAFF_EMAIL || 'staff@swarajagro.com', staffPassword, {
    userId: 'staff', name: 'Swaraj Agro Staff', initials: 'ST', role: 'Sales associate', isAdmin: false,
    permissions: { viewAmounts: true, recordSales: true, recordPurchases: true }
  });
  await ensureUser(process.env.INITIAL_WAREHOUSE_EMAIL || 'warehouse@swarajagro.com', warehousePassword, {
    userId: 'warehouse', name: 'Swaraj Agro Warehouse', initials: 'SW', role: 'Warehouse associate', isAdmin: false,
    permissions: { viewAmounts: false, recordSales: false, recordPurchases: true }
  });
}

function publicUser(user) {
  return {
    id: user.userId,
    userId: user.userId,
    name: user.name,
    initials: user.initials,
    email: user.email,
    loginId: user.loginId || user.email,
    role: user.role,
    isAdmin: Boolean(user.isAdmin),
    permissions: user.permissions || { viewAmounts: false, recordSales: false, recordPurchases: false }
  };
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), userId: user.userId, isAdmin: Boolean(user.isAdmin) }, JWT_SECRET, { expiresIn: '7d' });
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.collection('users').findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return res.status(401).json({ error: 'User account not found.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

async function getWorkspace() {
  const workspace = await db.collection('workspaces').findOne({ key: 'default' });
  if (!workspace) throw new Error('Workspace not initialized.');
  return normalizeWorkspace(workspace);
}

async function saveWorkspace(nextWorkspace) {
  const sanitized = normalizeWorkspace(nextWorkspace);
  sanitized.updatedAt = new Date();
  await db.collection('workspaces').updateOne({ key: 'default' }, { $set: sanitized });
  return sanitized;
}

function activeCompanyState(workspace, companyId) {
  const company = workspace.companies?.[companyId];
  if (!company) throw new Error('Company not found.');
  return company;
}


app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true, service: 'stockflow' });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await db.collection('users').findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'That email or password does not match this workspace.' });
    const workspace = await getWorkspace();
    const staffUsers = {};
    const users = await db.collection('users').find({}).project({ passwordHash: 0 }).toArray();
    for (const item of users) if (!item.isAdmin) staffUsers[item.userId] = publicUser(item);
    workspace.staffUsers = staffUsers;
    res.json({ token: signToken(user), user: publicUser(user), workspace });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

app.get('/api/bootstrap', auth, async (req, res) => {
  const workspace = await getWorkspace();
  const users = await db.collection('users').find({}).project({ passwordHash: 0 }).toArray();
  const staffUsers = {};
  for (const item of users) if (!item.isAdmin) staffUsers[item.userId] = publicUser(item);
  workspace.staffUsers = staffUsers;
  res.json({ user: publicUser(req.user), workspace });
});

app.put('/api/workspace', auth, requireAdmin, async (req, res) => {
  try {
    const candidate = normalizeWorkspace(req.body);
    if (!candidate.companies || typeof candidate.companies !== 'object') return res.status(400).json({ error: 'Invalid workspace payload.' });
    const workspace = await saveWorkspace(candidate);
    res.json({ workspace });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to save the workspace.' });
  }
});

app.post('/api/transactions', auth, async (req, res) => {
  try {
    const { companyId = 'machinery', type, productId, qty, price, accountName, date, note } = req.body;
    if (!['sale', 'purchase'].includes(type)) return res.status(400).json({ error: 'Invalid transaction type.' });
    const quantity = Number(qty); const unitPrice = Number(price);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 1) return res.status(400).json({ error: 'Invalid quantity or price.' });
    const permission = type === 'sale' ? 'recordSales' : 'recordPurchases';
    if (!req.user.isAdmin && !req.user.permissions?.[permission]) return res.status(403).json({ error: `You do not have permission to record ${type === 'sale' ? 'sales' : 'purchases'}.` });
    const workspace = await getWorkspace();
    const company = activeCompanyState(workspace, companyId);
    const product = company.products.find(p => Number(p.id) === Number(productId));
    const account = company.accounts.find(a => a.name === accountName);
    if (!product || !account) return res.status(404).json({ error: 'Product or account not found.' });
    if (type === 'sale' && quantity > Number(product.stock)) return res.status(400).json({ error: `Only ${product.stock} units of ${product.name} are available.` });
    product.stock += type === 'sale' ? -quantity : quantity;
    const total = quantity * unitPrice;
    account.balance += type === 'sale' ? total : -total;
    company.transactions.unshift({ id: Date.now(), type, productId: product.id, product: product.name, qty: quantity, price: unitPrice, account: account.name, date: date || new Date().toISOString().slice(0,10), note: String(note || '').trim() || (type === 'sale' ? 'New sale' : 'New purchase'), time: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) });
    const inv = company.accounts.find(a => a.type === 'Asset' || a.name.toLowerCase().includes('inventory'));
    if (inv) inv.balance = company.products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0);
    workspace.updatedAt = new Date();
    await saveWorkspace(workspace);
    res.json({ workspace, transaction: company.transactions[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to record that transaction.' });
  }
});

app.get('/api/users', auth, requireAdmin, async (req, res) => {
  const users = await db.collection('users').find({ isAdmin: false }).project({ passwordHash: 0 }).toArray();
  res.json({ users: users.map(publicUser) });
});

app.post('/api/users', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, name, role, email, password, permissions } = req.body;
    const loginId = String(email || '').trim().toLowerCase();
    if (!name || !role || !loginId || !password || String(password).length < 6) return res.status(400).json({ error: 'Complete the details and use a password of at least 6 characters.' });
    if (await db.collection('users').findOne({ email: loginId })) return res.status(409).json({ error: 'That access ID is already in use.' });
    const safeId = userId || `staff-${crypto.randomUUID()}`;
    const user = await ensureUser(loginId, password, { userId: safeId, name, initials: name.split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase(), role, isAdmin: false, permissions: permissions || {} });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to create staff access.' }); }
});

app.patch('/api/users/:userId', auth, requireAdmin, async (req, res) => {
  try {
    const allowed = {}; const { name, role, email, permissions, password } = req.body;
    if (name !== undefined) allowed.name = String(name).trim();
    if (role !== undefined) allowed.role = String(role).trim();
    if (email !== undefined) allowed.email = String(email).trim().toLowerCase();
    if (permissions !== undefined) allowed.permissions = permissions;
    if (password) allowed.passwordHash = await bcrypt.hash(String(password), 12);
    allowed.updatedAt = new Date();
    const query = { userId: req.params.userId, isAdmin: false };
    if (allowed.email && await db.collection('users').findOne({ email: allowed.email, userId: { $ne: req.params.userId } })) return res.status(409).json({ error: 'That access ID is already in use.' });
    const result = await db.collection('users').findOneAndUpdate(query, { $set: allowed }, { returnDocument: 'after', projection: { passwordHash: 0 } });
    const updated = result?.value ?? result;
    if (!updated) return res.status(404).json({ error: 'Staff account not found.' });
    if (allowed.name) { updated.initials = allowed.name.split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase(); await db.collection('users').updateOne(query, { $set: { initials: updated.initials } }); }
    res.json({ user: publicUser(updated) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update staff access.' }); }
});

app.post('/api/me/password', auth, async (req, res) => {
  try {
    const current = String(req.body.currentPassword || '');
    const next = String(req.body.newPassword || '');
    if (next.length < 6) return res.status(400).json({ error: 'Use a new password with at least 6 characters.' });
    if (!(await bcrypt.compare(current, req.user.passwordHash))) return res.status(400).json({ error: 'Your current password is not correct.' });
    await db.collection('users').updateOne({ _id: req.user._id }, { $set: { passwordHash: await bcrypt.hash(next, 12), updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update your password.' }); }
});

app.post('/api/reset-demo', auth, requireAdmin, async (req, res) => {
  const workspace = buildSeedWorkspace();
  await saveWorkspace(workspace);
  res.json({ workspace });
});

app.post('/api/cloudinary/signature', auth, requireAdmin, async (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Cloudinary is not configured.' });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || 'stockflow';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({ timestamp, folder, signature, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY });
});

app.post('/api/cloudinary/upload', auth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Cloudinary is not configured.' });
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    const folder = process.env.CLOUDINARY_FOLDER || 'stockflow';
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'auto' }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Cloudinary upload failed.' }); }
});

app.get(/.*/, (req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));

(async () => {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    await ensureWorkspace();
    await ensureUsers();
    app.listen(PORT, '0.0.0.0', () => console.log(`StockFlow running on port ${PORT}`));
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
})();
