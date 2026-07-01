const db = require('../db');

const rawLimit = process.env.MAX_GENERATIONS_PER_DAY;
const MAX_GENERATIONS_PER_DAY = rawLimit === '0' || rawLimit === '' ? 0 : (parseInt(rawLimit, 10) || 10);

async function checkRateLimit(sessionId) {
  // 0 = bez limitu (pro testování)
  if (MAX_GENERATIONS_PER_DAY === 0) return { allowed: true, remaining: null };
  if (!sessionId) return { allowed: false, remaining: 0 };
  try {
    const result = await db.query(
    `SELECT COUNT(*)::int as count FROM generation_log 
     WHERE session_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
    [sessionId]
  );
    if (!result || !result.rows[0]) return { allowed: true, remaining: MAX_GENERATIONS_PER_DAY };
    const count = result.rows[0].count;
    return {
      allowed: count < MAX_GENERATIONS_PER_DAY,
      remaining: Math.max(0, MAX_GENERATIONS_PER_DAY - count),
    };
  } catch {
    return { allowed: true, remaining: MAX_GENERATIONS_PER_DAY };
  }
}

async function logGeneration(sessionId, designId = null) {
  if (!sessionId) return null;
  try {
    const result = await db.query(
    `INSERT INTO generation_log (session_id, design_id) VALUES ($1, $2) RETURNING id`,
    [sessionId, designId]
  );
    return result ? result.rows[0] : null;
  } catch {
    return null;
  }
}

async function saveDesign({ prompt, widthCm, heightCm, pdfFilename, imageUrl, sessionId, productId }) {
  try {
    const result = await db.query(
    `INSERT INTO designs (prompt, width_cm, height_cm, pdf_filename, image_url, session_id, product_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [prompt, widthCm, heightCm, pdfFilename || null, imageUrl || null, sessionId || null, productId || null]
  );
    return result ? result.rows[0] : null;
  } catch {
    return null;
  }
}

module.exports = { checkRateLimit, logGeneration, saveDesign };
