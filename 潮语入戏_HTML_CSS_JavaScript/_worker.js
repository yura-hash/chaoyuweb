// 潮语入戏：Cloudflare Pages 后端。
// 密钥仅从 Cloudflare 环境变量读取。
const BUCKET = "chaoyu-media";
const COOKIE = "chaoyu_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_FILE_SIZE = 45 * 1024 * 1024;
const encoder = new TextEncoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function configuration(env) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY ||
    !env.ADMIN_PASSWORD
  ) {
    fail("网站后端配置不完整，请检查 Cloudflare 的三项变量。", 503);
  }

  let url;
  try {
    url = new URL(env.SUPABASE_URL.trim());
  } catch {
    fail("SUPABASE_URL 格式不正确。", 503);
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.pathname !== "/"
  ) {
    fail("请将 SUPABASE_URL 设置为项目首页的项目网址。", 503);
  }

  return {
    url: url.origin,
    secret: env.SUPABASE_SECRET_KEY.trim(),
  };
}

async function supabase(config, path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("apikey", config.secret);

  const response = await fetch(config.url + path, {
    ...options,
    headers,
   redirect: "manual",
  });

  if (!response.ok) {
    fail(
      `云端请求失败（${response.status}）。请检查连接密钥、数据表、存储桶或使用额度。`,
      503
    );
  }

  return response;
}

async function readJSON(request) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    fail("请求格式不正确。");
  }

  const text = await request.text();
  if (encoder.encode(text).length > 1024 * 1024) {
    fail("文字内容过大，请通过上传按钮添加文件。", 413);
  }

  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("请求内容不正确。");
    }
    return value;
  } catch {
    fail("无法读取请求内容。");
  }
}

function base64URL(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64URL(text) {
  const normal = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normal), char => char.charCodeAt(0));
}

async function signingKey(password) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createSession(password) {
  const payload = base64URL(
    encoder.encode(
      JSON.stringify({
        expires: Date.now() + SESSION_SECONDS * 1000,
        nonce: crypto.randomUUID(),
      })
    )
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(password),
    encoder.encode(payload)
  );

  return payload + "." + base64URL(new Uint8Array(signature));
}

async function isAdmin(request, env) {
  try {
    const cookie = (request.headers.get("Cookie") || "")
      .split(";")
      .map(item => item.trim())
      .find(item => item.startsWith(COOKIE + "="));

    if (!cookie) return false;

    const token = cookie.slice(COOKIE.length + 1);
    if (token.length > 1000) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    const verified = await crypto.subtle.verify(
      "HMAC",
      await signingKey(env.ADMIN_PASSWORD),
      decodeBase64URL(signature),
      encoder.encode(payload)
    );

    if (!verified) return false;

    const data = JSON.parse(
      new TextDecoder().decode(decodeBase64URL(payload))
    );
    return typeof data.expires === "number" && data.expires > Date.now();
  } catch {
    return false;
  }
}

function sessionCookie(token, maxAge) {
  return (
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; ` +
    `SameSite=Strict; Max-Age=${maxAge}`
  );
}

async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) {
    fail("请先通过管理员验证。", 401);
  }
}

async function loadRecords(config) {
  const response = await supabase(
    config,
    "/rest/v1/chaoyu_records?select=kind,data&order=updated_at.asc"
  );
  return response.json();
}

async function api(request, env) {
  const config = configuration(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 拒绝其他网站借用当前管理员会话修改内容。
  if (!["GET", "HEAD"].includes(method)) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) {
      fail("不允许跨网站提交。", 403);
    }
  }

  if (path === "/api/health" && method === "GET") {
    await Promise.all([
      supabase(
        config,
        "/rest/v1/chaoyu_records?select=id&limit=1"
      ),
      supabase(config, "/storage/v1/bucket/" + BUCKET),
    ]);
    return json({ ok: true, message: "数据库和存储桶连接成功" });
  }

  if (path === "/api/session") {
    if (method === "GET") {
      return json({ admin: await isAdmin(request, env) });
    }

    if (method === "DELETE") {
      return json(
        { ok: true },
        200,
        { "Set-Cookie": sessionCookie("", 0) }
      );
    }

    if (method !== "POST") fail("不支持此操作。", 405);

    const body = await readJSON(request);
    const validNumber = ["1", "2", "3", "4", "5"].includes(
      String(body.number)
    );

    if (!validNumber || body.password !== env.ADMIN_PASSWORD) {
      fail("管理员编号或密码不正确。", 401);
    }

    const token = await createSession(env.ADMIN_PASSWORD);
    return json(
      { admin: true },
      200,
      { "Set-Cookie": sessionCookie(token, SESSION_SECONDS) }
    );
  }

  if (path === "/api/content") {
    if (method === "GET") {
      const rows = await loadRecords(config);
      return json({
        words: rows.filter(row => row.kind === "word").map(row => row.data),
        works: rows.filter(row => row.kind === "work").map(row => row.data),
        about: rows.find(row => row.kind === "about")?.data || null,
        topics: [],
      });
    }

    if (method !== "POST") fail("不支持此操作。", 405);
    await requireAdmin(request, env);

    const { kind, record } = await readJSON(request);
    if (
      !["word", "work", "about"].includes(kind) ||
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      fail("内容格式不正确。");
    }

    const required =
      kind === "word"
        ? ["word", "dialect", "translation", "intro", "topic"]
        : kind === "work"
          ? ["name", "basic", "intro"]
          : ["title", "body"];

    if (
      required.some(
        key => typeof record[key] !== "string" || !record[key].trim()
      )
    ) {
      fail("请填写完整内容。");
    }

    if (kind === "about") record.id = "about";
    if (
      typeof record.id !== "string" ||
      !record.id.trim() ||
      record.id.length > 150
    ) {
      fail("记录编号不正确。");
    }

    if (kind === "word") {
      record.topic = record.topic.trim().replace(/^\./, "");
      if (!record.topic) fail("请填写选题。");

      const rows = await loadRecords(config);
      if (
        rows.some(
          row =>
            row.kind === "word" &&
            row.data.id !== record.id &&
            row.data.word?.trim() === record.word.trim()
        )
      ) {
        fail("该词语已存在，请避免重复添加。", 409);
      }
    }

    await supabase(
      config,
      "/rest/v1/chaoyu_records?on_conflict=id",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: kind + ":" + record.id,
          kind,
          data: record,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return json({ ok: true });
  }

  if (path === "/api/submissions") {
    if (method === "GET") {
      await requireAdmin(request, env);
      const response = await supabase(
        config,
        "/rest/v1/chaoyu_submissions?select=*&order=created.desc"
      );
      return json(await response.json());
    }

    if (method !== "POST") fail("不支持此操作。", 405);

    const body = await readJSON(request);
    const work = typeof body.work === "string" ? body.work.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!work || !message) fail("请填写作品名和留言备注。");
    if (work.length > 200 || message.length > 5000) {
      fail("作品名不能超过 200 字，留言不能超过 5000 字。");
    }

    await supabase(config, "/rest/v1/chaoyu_submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ work, message }),
    });
    return json({ ok: true });
  }

  if (path === "/api/files") {
    if (method !== "POST") fail("不支持此操作。", 405);
    await requireAdmin(request, env);

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > MAX_FILE_SIZE + 1024 * 1024) {
      fail("单个文件不能超过 45 MB。", 413);
    }

    const form = await request.formData();
    const file = form.get("file");

    if (
      !(file instanceof File) ||
      !/^(image|audio|video)\//.test(file.type) ||
      file.type === "image/svg+xml"
    ) {
      fail("请选择图片、音频或视频文件（不支持 SVG）。");
    }

    if (file.size === 0) fail("不能上传空文件。");
    if (file.size > MAX_FILE_SIZE) {
      fail("单个文件不能超过 45 MB，请先压缩或剪辑。", 413);
    }

    const suffix = file.name.split(".").pop().toLowerCase();
    const extension = /^[a-z0-9]{1,10}$/.test(suffix) ? "." + suffix : "";
    const filename = crypto.randomUUID() + extension;

    await supabase(
      config,
      `/storage/v1/object/${BUCKET}/${filename}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "Cache-Control": "max-age=3600",
          "x-upsert": "false",
        },
        body: file,
      }
    );

    return json({
      url: `${config.url}/storage/v1/object/public/${BUCKET}/${filename}`,
      type: file.type,
    });
  }

  fail("未找到接口。", 404);
}

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      return await api(request, env);
    } catch (error) {
      // 临时排查信息：先去除密钥和密码。
      let details = String(error?.message || "未知错误");

      for (const secret of [
        env.SUPABASE_SECRET_KEY,
        env.ADMIN_PASSWORD,
      ]) {
        if (typeof secret === "string" && secret.length > 0) {
          details = details.split(secret).join("[已隐藏]");
        }
      }

      details = details.replace(
        /sb_secret_[A-Za-z0-9_-]+/g,
        "[已隐藏密钥]"
      );

      return json(
        {
          error: error.status
            ? error.message
            : "连接检查失败，请查看 details。",
          type: error.name || "Error",
          details: details.slice(0, 400),
        },
        error.status || 503
      );
    }
  },
};
