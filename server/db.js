const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connUrl = process.env.DATABASE_URL;
    if (!connUrl) {
      console.warn('DATABASE_URL není nastaven – databázové funkce budou přeskočeny');
      return null;
    }
    pool = new Pool({
      connectionString: connUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      client_encoding: 'UTF8',
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) return null;
  try {
    return await p.query(text, params);
  } catch (err) {
    console.error('DB query error:', err.message);
    throw err;
  }
}

module.exports = { getPool, query };
