const { getFile } = require('./_lib/github');

const SERVICES = {
  body: { name: '身體開運 Spa', duration: 120 },
  head: { name: '頭部舒壓 Spa', duration: 60 },
  warm: { name: '暖宮 Spa', duration: 90 },
};

function pad(n) {
  return String(n).padStart(2, '0');
}
function monthStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
function fmt(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
}

module.exports = async function handler(req, res) {
  const key = req.query.key;
  if (!key || key !== process.env.ADMIN_TOKEN) {
    res.status(401);
    return res.end('unauthorized');
  }

  const now = new Date();
  const months = [-1, 0, 1, 2].map((i) => monthStr(new Date(now.getFullYear(), now.getMonth() + i, 1)));

  let events = [];
  for (const m of months) {
    try {
      const { content } = await getFile(`data/bookings/${m}.json`);
      if (content) events = events.concat(JSON.parse(content));
    } catch (e) {
      /* 該月份還沒有任何預約資料就跳過 */
    }
  }
  events = events.filter((b) => b.status !== 'cancelled');

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SoulBlueprintSpa//Booking//ZH-TW', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:靈魂藍圖SPA 預約行事曆'];
  events.forEach((b) => {
    const svc = SERVICES[b.serviceId] || { name: b.serviceId, duration: 60 };
    const [hh, mm] = b.time.split(':').map(Number);
    const start = new Date(b.date + 'T00:00:00');
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + svc.duration * 60000);
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + b.id + '@soulblueprintspa');
    lines.push('DTSTAMP:' + fmt(new Date()));
    lines.push('DTSTART:' + fmt(start));
    lines.push('DTEND:' + fmt(end));
    lines.push('SUMMARY:' + svc.name + ' - ' + b.customer.name);
    lines.push('DESCRIPTION:電話 ' + b.customer.phone);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.status(200).send(lines.join('\r\n'));
};
