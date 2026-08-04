const { getFile, readModifyWrite } = require('./_lib/github');

function monthFile(month) {
  return `data/bookings/${month}.json`;
}
function custPath() {
  return 'data/customers.json';
}
function isAdmin(req) {
  const token = req.headers['x-admin-token'];
  return !!token && token === process.env.ADMIN_TOKEN;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const month = (req.query.month || '').toString();
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month 格式需為 YYYY-MM' });
    try {
      const { content } = await getFile(monthFile(month));
      const list = content ? JSON.parse(content) : [];
      if (isAdmin(req)) return res.status(200).json(list);
      // 非管理員（客戶預約流程）只回傳判斷是否可預約需要的最小資訊，不外流客戶個資
      const pub = list.filter((b) => b.status !== 'cancelled').map((b) => ({ date: b.date, time: b.time, status: b.status }));
      return res.status(200).json(pub);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const b = req.body;
      if (!b || !b.date || !b.time || !b.serviceId || !b.customer || !b.customer.name || !b.customer.phone) {
        return res.status(400).json({ error: '缺少必要欄位' });
      }
      const month = b.date.slice(0, 7);
      const path = monthFile(month);
      let newBooking = null;

      const result = await readModifyWrite(
        path,
        (list) => {
          const conflict = list.some((x) => x.date === b.date && x.time === b.time && x.status !== 'cancelled');
          if (conflict) return { abort: true, reason: 'slot_taken' };
          newBooking = {
            id: 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            serviceId: b.serviceId,
            addons: b.addons || [],
            date: b.date,
            time: b.time,
            price: b.price || 0,
            customer: b.customer,
            concerns: b.concerns || [],
            note: b.note || '',
            status: 'confirmed',
            createdAt: new Date().toISOString(),
          };
          list.push(newBooking);
          return { ok: true };
        },
        `新增預約 ${b.date} ${b.time} ${b.customer.name}`
      );

      if (result.abort) {
        return res.status(409).json({ error: 'slot_taken', message: '這個時段剛好被別人訂走了，請重新選擇時段' });
      }

      // 同步更新客戶資料（新客建檔／舊客補上這次到店紀錄），失敗不影響預約本身成功
      try {
        await readModifyWrite(
          custPath(),
          (custs) => {
            let cust = custs.find((c) => c.phone === b.customer.phone);
            if (!cust) {
              cust = {
                phone: b.customer.phone,
                name: b.customer.name,
                line: b.customer.line || '',
                birthday: b.customer.birthday || '',
                balance: 0,
                sessionsRemaining: 0,
                ledger: [],
                visits: [],
                createdAt: new Date().toISOString(),
              };
              custs.push(cust);
            } else {
              cust.name = b.customer.name;
              cust.line = b.customer.line || cust.line;
              cust.birthday = b.customer.birthday || cust.birthday;
            }
            cust.visits.push({ date: b.date, time: b.time, serviceId: b.serviceId, bookingId: newBooking.id });
            return { ok: true };
          },
          `更新客戶資料 ${b.customer.name}`
        );
      } catch (e) {
        console.error('customer update failed', e.message);
      }

      return res.status(200).json(newBooking);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
};
