const { getFile, putRawFile, readModifyWrite } = require('./_lib/github');
const PATH = 'data/services.json';

function slugify() {
  return 'sv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });

  const { action, id, name, duration, price, desc, note, imageBase64, imageExt } = req.body || {};
  if (!action) return res.status(400).json({ error: '缺少 action' });

  try {
    // 圖片上傳單獨處理：先把檔案寫進repo，拿到路徑後再更新service紀錄裡的image欄位
    if (action === 'upload-image') {
      if (!id || !imageBase64 || !imageExt) return res.status(400).json({ error: '缺少 id 或圖片內容' });
      const ext = String(imageExt).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const imgPath = `assets/services/${id}.${ext}`;
      const { sha: imgSha } = await getFile(imgPath);
      await putRawFile(imgPath, imageBase64, imgSha, `上傳服務示意圖片 ${id}`);
      const imageUrl = '/' + imgPath + '?v=' + Date.now();

      let updated = null;
      const outcome = await readModifyWrite(
        PATH,
        (list) => {
          const rec = list.find((s) => s.id === id);
          if (!rec) return { abort: true, reason: 'not_found' };
          rec.image = imageUrl;
          updated = rec;
          return { ok: true };
        },
        `更新服務示意圖片 ${id}`
      );
      if (outcome.abort) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(updated);
    }

    let resultRecord = null;
    const outcome = await readModifyWrite(
      PATH,
      (list) => {
        if (action === 'create') {
          if (!name || price === undefined || price === null || isNaN(Number(price)) || !duration || isNaN(Number(duration))) {
            return { abort: true, reason: 'invalid_input' };
          }
          const rec = {
            id: slugify(),
            name: String(name).trim(),
            duration: Number(duration),
            price: Number(price),
            desc: desc ? String(desc).trim() : '',
            image: null,
            active: true,
            priceHistory: [{ price: Number(price), changedAt: new Date().toISOString(), note: note || '建立' }],
            createdAt: new Date().toISOString(),
          };
          list.push(rec);
          resultRecord = rec;
          return { ok: true };
        }

        const rec = list.find((s) => s.id === id);
        if (!rec) return { abort: true, reason: 'not_found' };

        if (action === 'update') {
          if (name !== undefined && name !== null && String(name).trim()) rec.name = String(name).trim();
          if (duration !== undefined && duration !== null && !isNaN(Number(duration))) rec.duration = Number(duration);
          if (desc !== undefined && desc !== null) rec.desc = String(desc).trim();
          if (price !== undefined && price !== null && !isNaN(Number(price)) && Number(price) !== rec.price) {
            rec.price = Number(price);
            rec.priceHistory = rec.priceHistory || [];
            rec.priceHistory.push({ price: Number(price), changedAt: new Date().toISOString(), note: note || '' });
          }
          resultRecord = rec;
          return { ok: true };
        }

        if (action === 'deactivate') { rec.active = false; resultRecord = rec; return { ok: true }; }
        if (action === 'activate') { rec.active = true; resultRecord = rec; return { ok: true }; }

        return { abort: true, reason: 'unknown_action' };
      },
      `主要服務管理 ${action} ${name || id || ''}`
    );

    if (outcome.abort) {
      if (outcome.reason === 'invalid_input') return res.status(400).json({ error: '缺少名稱、時長或價格' });
      if (outcome.reason === 'not_found') return res.status(404).json({ error: 'not found' });
      return res.status(400).json({ error: outcome.reason });
    }
    return res.status(200).json(resultRecord);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
