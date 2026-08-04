const OWNER = 'adolph-CEO';
const REPO = 'Linda';
const BRANCH = 'main';
const GH_API = 'https://api.github.com';

function ghHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'linda-spa-booking',
  };
}

// 讀取repo內的一個檔案，回傳 {content, sha}；檔案不存在時 content 為 null
async function getFile(path) {
  const url = `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${BRANCH}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return { content: null, sha: null };
  if (!r.ok) throw new Error('GitHub read failed: ' + r.status + ' ' + (await r.text()));
  const j = await r.json();
  const content = Buffer.from(j.content, 'base64').toString('utf8');
  return { content, sha: j.sha };
}

// 寫入/更新repo內的一個檔案（存的是JSON物件），有sha衝突時丟出錯誤讓呼叫端決定要不要重試
async function putFile(path, dataObj, sha, message) {
  const url = `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(dataObj, null, 2)).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error('GitHub write failed: ' + r.status + ' ' + t);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// 帶重試的寫入：讀最新版本 -> 呼叫 mutateFn(list) 修改內容 -> 寫回，若sha衝突（代表同時間有別人也寫入了）就重讀重試
async function readModifyWrite(path, mutateFn, message, maxRetry = 4) {
  for (let i = 0; i < maxRetry; i++) {
    const { content, sha } = await getFile(path);
    const list = content ? JSON.parse(content) : [];
    const result = mutateFn(list);
    if (result && result.abort) return result; // 呼叫端主動中止（例如時段已被訂走）
    try {
      await putFile(path, list, sha, message);
      return { ok: true, list };
    } catch (e) {
      if (e.status === 409 || e.status === 422) continue; // 版本衝突，重試
      throw e;
    }
  }
  throw new Error('寫入重試次數過多，請稍後再試一次');
}

function listDir(path) {
  const url = `${GH_API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
  return fetch(url, { headers: ghHeaders() }).then(async (r) => {
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('GitHub list failed: ' + r.status);
    return r.json();
  });
}

module.exports = { getFile, putFile, readModifyWrite, listDir, ghHeaders, OWNER, REPO, BRANCH };
