const { getFile, readModifyWrite } = require('./_lib/github');
const CUST_PATH = 'data/customers.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'GET') {
    try {
      const { content } = await getFile(CUST_PATH);
      return res.status(200).json(content ? JSON.parse(content) : []);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { phone, balance, sessionsRemaining, note } = req.body || {};
    if (!phone) return res.status(400).json({ error: '缺少 phone' });
    try {
      let updated = null;
      const result = await readModifyWrite(
        CUST_PATH,
        (list) => {
          const c = list.find((x) => x.phone === phone);
          if (!c) return { abort: true, reason: 'not_found' };
          c.balance = Number(balance) || 0;
          c.sessionsRemaining = Number(sessionsRemaining) || 0;
          c.ledger = c.ledger || [];
          c.ledger.push({ date: new Date().toISOString(), balance: c.balance, sessions: c.sessionsRemaining, note: note || '' });
          updated = c;
          return { ok: true };
        },
        `更新儲值資料 ${phone}`
      );
      if (result.abort) return res.status(404).json({ error: 'customer not found' });
      return res.status(200).json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
