const { getFile } = require('./_lib/github');
const PATH = 'data/addons.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  try {
    const { content } = await getFile(PATH);
    const list = content ? JSON.parse(content) : [];
    const token = req.headers['x-admin-token'];
    const isAdmin = token && token === process.env.ADMIN_TOKEN;
    if (isAdmin) return res.status(200).json(list); // 含停用項目、完整價格歷史
    const pub = list.filter((a) => a.active !== false).map((a) => ({ id: a.id, name: a.name, price: a.price }));
    return res.status(200).json(pub);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
