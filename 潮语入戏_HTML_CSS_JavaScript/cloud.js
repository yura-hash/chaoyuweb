/* 将现有网页连接到云端，保留原始科普资料。 */
(() => {
  const networkFetch = window.fetch.bind(window);

  const defaultAbout = {
    id: "about",
    title: "让家乡的声音，被更多人听见。",
    body:
      "从电影与歌曲里的地道词语出发，读懂潮语的意思，" +
      "也读懂称谓、家书与日常生活背后的文化。\n\n" +
      "本段为依据项目目标撰写的 Demo 简介，正式项目介绍待补充。",
    poster: "",
  };

  function merge(base = [], edits = []) {
    const records = new Map(base.map(item => [item.id, item]));
    for (const item of edits) records.set(item.id, item);
    return [...records.values()];
  }

  function reply(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  function combine(cloud) {
    const seed = window.CHAOYU_SEED || {};
    const words = merge(seed.words || [], cloud.words || []);
    const works = merge(seed.works || [], cloud.works || []);

    const topics = [
      ...new Set([
        ...(seed.topics || []),
        ...(cloud.topics || []),
        ...words.map(item => item.topic).filter(Boolean),
      ]),
    ];

    return {
      words,
      works,
      topics,
      about: cloud.about || defaultAbout,
    };
  }

  async function cloudFetch(input, options = {}) {
    const address =
      input instanceof Request ? input.url : String(input);
    const url = new URL(address, window.location.href);

    if (
      url.origin !== window.location.origin ||
      !url.pathname.startsWith("/api/")
    ) {
      return networkFetch(input, options);
    }

    const method = String(
      options.method ||
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    try {
      // 避免重复添加原始资料或云端已有的词语。
      if (
        url.pathname === "/api/content" &&
        method === "POST" &&
        typeof options.body === "string"
      ) {
        const payload = JSON.parse(options.body);

        if (payload.kind === "word" && payload.record) {
          const current = await networkFetch("/api/content", {
            credentials: "same-origin",
            cache: "no-store",
          });

          if (!current.ok) return current;

          const content = combine(await current.json());
          const record = payload.record;

          if (
            content.words.some(
              item =>
                item.id !== record.id &&
                String(item.word || "").trim() ===
                  String(record.word || "").trim()
            )
          ) {
            return reply(
              { error: "该词语已存在，请避免重复添加。" },
              409
            );
          }
        }
      }

      const response = await networkFetch(input, {
        ...options,
        credentials: "same-origin",
      });

      if (
        url.pathname === "/api/content" &&
        method === "GET" &&
        response.ok
      ) {
        return reply(combine(await response.json()));
      }

      return response;
    } catch {
      return reply(
        { error: "无法连接云端，请检查网络后重试。内容尚未确认保存。" },
        503
      );
    }
  }

  // 兼容已有 app.js，阻止其切回浏览器本地保存。
  Object.defineProperty(window, "fetch", {
    configurable: true,
    enumerable: true,
    get() {
      return cloudFetch;
    },
    set(_offlineFetch) {
      // 继续使用上面的云端接口。
    },
  });
})();
