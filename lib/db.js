const { MongoClient } = require('mongodb');

let dbPromise = null;

// Returns a connected database handle, or null if MONGODB_URI isn't configured
// (in which case callers fall back to local file storage — useful for local dev).
function getDb() {
  if (!process.env.MONGODB_URI) return Promise.resolve(null);
  if (!dbPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    dbPromise = client.connect().then(c => c.db(process.env.MONGODB_DB || 'ds_swaraj_agro'));
  }
  return dbPromise;
}

module.exports = { getDb };
