/* 离线演示数据适配。线上版仍使用完整项目中的 D1/R2 服务。 */
const nativeFetch = window.fetch.bind(window);
const baseSeed = window.CHAOYU_SEED;
const baseAbout = { id: 'about', title: '让家乡的声音，被更多人听见。', body: '从电影与歌曲里的地道词语出发，读懂潮语的意思，也读懂称谓、家书与日常生活背后的文化。\n\n本段为依据项目目标撰写的 Demo 简介，正式项目介绍待补充。', poster: '' };
const ready = new Promise((resolve, reject) => {
  const request = indexedDB.open('chaoyu-offline-demo-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('state');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('浏览器禁止本地保存，请允许网站存储或更换浏览器。'));
});
async function readState() {
  const db = await ready;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const request = tx.objectStore('state').get('content');
    request.onsuccess = () => resolve(request.result || { words: [], works: [], about: null, submissions: [] });
    request.onerror = () => reject(request.error);
  });
}
async function writeState(state) {
  const db = await ready;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(state, 'content');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error('保存失败，可能是浏览器存储空间不足。'));
    tx.onabort = () => reject(new Error('保存失败，已填写的内容仍保留。'));
  });
}
function isAdmin() {
  return Number(sessionStorage.getItem('chaoyu-admin-until') || 0) > Date.now();
}
function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function merge(base, edits) {
  const records = new Map(base.map(record => [record.id, record]));
  for (const record of edits) records.set(record.id, record);
  return [...records.values()];
}
window.fetch = async function(input, options = {}) {
  if (typeof input !== 'string' || !input.startsWith('/api/')) return nativeFetch(input, options);
  try {
    const method = options.method || 'GET';
    const payload = typeof options.body === 'string' ? JSON.parse(options.body) : null;
    if (input === '/api/session') {
      if (method === 'GET') return reply({ admin: isAdmin() });
      if (method === 'DELETE') { sessionStorage.removeItem('chaoyu-admin-until'); return reply({ ok: true }); }
      if (!['1', '2', '3', '4', '5'].includes(String(payload.number)) || payload.password !== 'Goforcreation2026') return reply({ error: '管理员编号或密码不正确' }, 401);
      sessionStorage.setItem('chaoyu-admin-until', String(Date.now() + 8 * 3600000));
      return reply({ admin: true });
    }
    const state = await readState();
    if (input === '/api/content') {
      if (method === 'GET') return reply({ words: merge(baseSeed.words, state.words), works: merge(baseSeed.works, state.works), topics: baseSeed.topics, about: state.about || baseAbout });
      if (!isAdmin()) return reply({ error: '请先通过管理员验证' }, 401);
      const { kind, record } = payload;
      const required = kind === 'word' ? ['word', 'dialect', 'translation', 'intro', 'topic'] : kind === 'work' ? ['name', 'basic', 'intro'] : ['title', 'body'];
      if (!['word', 'work', 'about'].includes(kind) || !record || required.some(key => typeof record[key] !== 'string' || !record[key].trim())) return reply({ error: '请填写完整内容' }, 400);
      if (kind === 'about') state.about = record;
      else {
        const key = kind === 'word' ? 'words' : 'works';
        if (kind === 'word') {
          record.topic = record.topic.trim().replace(/^\./, '');
          if (merge(baseSeed.words, state.words).some(word => word.id !== record.id && word.word.trim() === record.word.trim())) return reply({ error: '该词语已存在，请避免重复添加。' }, 409);
        }
        state[key] = state[key].filter(item => item.id !== record.id);
        state[key].push(record);
      }
      await writeState(state);
      return reply({ ok: true });
    }
    if (input === '/api/submissions') {
      if (method === 'GET') return isAdmin() ? reply([...state.submissions].reverse()) : reply({ error: '需要管理员验证' }, 401);
      if (!payload.work?.trim() || !payload.message?.trim()) return reply({ error: '请填写作品名和留言备注' }, 400);
      state.submissions.push({ id: crypto.randomUUID(), work: payload.work.trim(), message: payload.message.trim(), created: new Date().toISOString() });
      await writeState(state);
      return reply({ ok: true });
    }
    if (input === '/api/files') {
      if (!isAdmin()) return reply({ error: '需要管理员验证' }, 401);
      const file = options.body.get('file');
      if (!(file instanceof File) || !/^(image|audio|video)\//.test(file.type) || file.type === 'image/svg+xml') return reply({ error: '请选择图片、音频或视频文件（SVG 不支持）' }, 400);
      if (file.size > 100 * 1024 * 1024) return reply({ error: '文件不能超过 100 MB' }, 400);
      const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('无法读取文件')); reader.readAsDataURL(file); });
      return reply({ url, type: file.type });
    }
    return reply({ error: '未找到接口' }, 404);
  } catch (error) {
    return reply({ error: error.message || '本地保存失败，请检查浏览器设置。' }, 503);
  }
};
