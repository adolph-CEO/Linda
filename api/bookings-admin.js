const { readModifyWrite } = require('./_lib/github');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });

  const { id, date } = req.body || {};
  if (!id || !date) return res.status(400).json({ error: '缺少 id 或 date' });
  const path = `data/bookings/${date.slice(0, 7)}.json`;

  try {
    let found = false;
    await readModifyWrite(
      path,
      (list) => {
        const b = list.find((x) => x.id === id);
        if (!b) return { abort: true, reason: 'not_found' };
        b.status = 'cancelled';
        found = true;
        return { ok: true };
      },
      `取消預約 ${id}`
    );
    if (!found) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
