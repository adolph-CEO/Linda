const { readModifyWrite } = require('./_lib/github');
const PATH = 'data/addons.json';

function slugify(name) {
  return (
    'ad_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });

  const { action, id, name, price, note } = req.body || {};
  if (!action) return res.status(400).json({ error: '缺少 action' });

  try {
    let resultRecord = null;

    const outcome = await readModifyWrite(
      PATH,
      (list) => {
        if (action === 'create') {
          if (!name || price === undefined || price === null || isNaN(Number(price))) {
            return { abort: true, reason: 'invalid_input' };
          }
          const rec = {
            id: slugify(name),
            name: String(name).trim(),
            price: Number(price),
            active: true,
            priceHistory: [{ price: Number(price), changedAt: new Date().toISOString(), note: note || '建立' }],
            createdAt: new Date().toISOString(),
          };
          list.push(rec);
          resultRecord = rec;
          return { ok: true };
        }

        const rec = list.find((a) => a.id === id);
        if (!rec) return { abort: true, reason: 'not_found' };

        if (action === 'update') {
          if (name !== undefined && name !== null && String(name).trim()) rec.name = String(name).trim();
          if (price !== undefined && price !== null && !isNaN(Number(price)) && Number(price) !== rec.price) {
            rec.price = Number(price);
            rec.priceHistory = rec.priceHistory || [];
            rec.priceHistory.push({ price: Number(price), changedAt: new Date().toISOString(), note: note || '' });
          }
          resultRecord = rec;
          return { ok: true };
        }

        if (action === 'deactivate') {
          rec.active = false;
          resultRecord = rec;
          return { ok: true };
        }

        if (action === 'activate') {
          rec.active = true;
          resultRecord = rec;
          return { ok: true };
        }

        return { abort: true, reason: 'unknown_action' };
      },
      `加購服務管理 ${action} ${name || id || ''}`
    );

    if (outcome.abort) {
      if (outcome.reason === 'invalid_input') return res.status(400).json({ error: '缺少名稱或價格' });
      if (outcome.reason === 'not_found') return res.status(404).json({ error: 'not found' });
      return res.status(400).json({ error: outcome.reason });
    }

    return res.status(200).json(resultRecord);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
