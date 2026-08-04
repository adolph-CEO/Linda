const { getFile, listDir } = require('./_lib/github');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });

  try {
    const files = await listDir('data/bookings');
    let all = [];
    for (const f of files) {
      if (!f.name || !f.name.endsWith('.json')) continue;
      const { content } = await getFile('data/bookings/' + f.name);
      if (content) all = all.concat(JSON.parse(content));
    }
    return res.status(200).json(all);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
