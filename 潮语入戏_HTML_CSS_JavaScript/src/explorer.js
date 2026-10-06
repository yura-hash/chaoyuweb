// 页面逻辑的可读 JavaScript 源码。运行入口为上级目录 app.js。
"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowLeft, Search, Plus, Upload, Film, Music2, Headphones, BookOpen, ShieldCheck, Leaf, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";
import seed from "@/lib/seed.json";
async function api(url, body, method) {
  const r = await fetch(url, { method: method || (body ? "POST" : "GET"), ...body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {} });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "操作失败，请重试");
  return d;
}
function Explorer() {
  const [data, setData] = useState({ ...seed, about: { id: "about", title: "让家乡的声音，被更多人听见。", body: "从电影与歌曲里的地道词语出发，读懂潮语的意思，也读懂称谓、家书与日常生活背后的文化。\n\n本段为依据项目目标撰写的 Demo 简介，正式项目介绍待补充。", poster: "" } });
  const [view, setView] = useState("gate"), [tab, setTab] = useState("home"), [admin, setAdmin] = useState(false), [topic, setTopic] = useState("全部"), [q, setQ] = useState(""), [page, setPage] = useState(1), [id, setId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [entries, setEntries] = useState([]), [draft, setDraft] = useState({}), [editField, setEditField] = useState("");
  async function refresh() {
    try {
      setData(await api("/api/content"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
    api("/api/session").then((d) => setAdmin(d.admin)).catch(() => {
    });
    const onHash = () => {
      const [v, i] = location.hash.slice(1).split("/");
      if (["home", "works", "about"].includes(v)) {
        setView("browse");
        setTab(v);
      } else if (["word", "work"].includes(v)) {
        setView(v);
        setId(decodeURIComponent(i || ""));
      } else setView("gate");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (tab === "about" && admin) api("/api/submissions").then(setEntries).catch((e) => toast.error(e.message));
  }, [tab, admin]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({ name: "search_chaoyu_words", description: "筛选并展示首页词语搜索结果", inputSchema: { type: "object", properties: { keyword: { type: "string" } }, required: ["keyword"], additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async (input) => {
        if (typeof input.keyword !== "string") throw Error("keyword 必须是文字");
        setQ(input.keyword);
        setTopic("全部");
        setPage(1);
        go("home");
        return { matches: data.words.filter((w) => [w.word, w.dialect, w.translation, w.intro].some((s) => s.includes(input.keyword))).map((w) => ({ id: w.id, word: w.word })) };
      } }, { signal: lifecycle.signal })).catch(() => {
      });
    } catch {
    }
    return () => lifecycle.abort();
  }, [data]);
  function go(v, i = "") {
    if (["home", "works", "about"].includes(v)) {
      setView("browse");
      setTab(v);
    } else if (["word", "work"].includes(v)) {
      setView(v);
      setId(i);
    } else setView("gate");
    location.hash = v + (i ? "/" + encodeURIComponent(i) : "");
    setEditField("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(kind, record) {
    await api("/api/content", { kind, record });
    await refresh();
    toast.success("内容已保存");
  }
  async function upload(file) {
    const form = new FormData();
    form.set("file", file);
    const r = await fetch("/api/files", { method: "POST", body: form });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  function fileControl(label, accept, cb) {
    return /* @__PURE__ */ jsxs("label", { className: "upload-btn " + (busy ? "disabled" : ""), children: [
      /* @__PURE__ */ jsx(Upload, { size: 14 }),
      busy ? "处理中…" : label,
      /* @__PURE__ */ jsx("input", { disabled: busy, type: "file", accept, onChange: (e) => {
        const f = e.target.files?.[0];
        if (f) run(() => cb(f));
        e.target.value = "";
      } })
    ] });
  }
  const topics = ["全部", .../* @__PURE__ */ new Set([...seed.topics, ...data.words.map((w) => w.topic)])];
  const filtered = data.words.filter((w) => (topic === "全部" || w.topic === topic) && [w.word, w.dialect, w.translation, w.intro].some((s) => s.toLowerCase().includes(q.trim().toLowerCase())));
  const word = data.words.find((w) => w.id === id), work = data.works.find((w) => w.id === id);
  function cover(record, kind, index) {
    const owner = kind === "word" ? data.works.find((w) => w.id === record.workIds?.[0]) : record;
    return /* @__PURE__ */ jsxs("div", { className: "cover tone-" + index % 6, children: [
      record.poster ? /* @__PURE__ */ jsx("img", { src: record.poster, alt: kind === "word" ? record.word + " 海报" : record.name + " 海报" }) : /* @__PURE__ */ jsxs("div", { className: "text-cover", children: [
        /* @__PURE__ */ jsx("span", { className: "cover-type", children: owner?.name.startsWith("歌曲") ? "潮语 · 音乐" : "潮语 · 电影" }),
        /* @__PURE__ */ jsx("span", { className: "cover-mark", children: kind === "word" ? "语" : "戏" }),
        /* @__PURE__ */ jsx("h3", { children: (owner?.name || "作品出处待补充").replace(/^(电影|歌曲)《|》$/g, "") }),
        /* @__PURE__ */ jsx("span", { className: "cover-caption", children: "文字封面 · 海报待补充" })
      ] }),
      admin && /* @__PURE__ */ jsx("div", { className: "cover-upload", children: fileControl("上传海报", "image/*", async (f) => {
        const a = await upload(f);
        await save(kind, { ...record, poster: a.url });
      }) })
    ] });
  }
  function begin(kind) {
    setDraft(kind === "word" ? { id: crypto.randomUUID(), word: "", dialect: "", translation: "", intro: "", topic: "", workIds: [], poster: "", media: "", mediaType: "", note: "" } : { id: crypto.randomUUID(), name: "", basic: "", intro: "", poster: "" });
    setView("add-" + kind);
  }
  function field(label, key, multi = false, placeholder = "") {
    return /* @__PURE__ */ jsxs("label", { className: "field", children: [
      /* @__PURE__ */ jsx("span", { children: label }),
      multi ? /* @__PURE__ */ jsx(Textarea, { required: true, value: draft[key] || "", onChange: (e) => setDraft({ ...draft, [key]: e.target.value }), placeholder, rows: 5 }) : /* @__PURE__ */ jsx(Input, { required: true, value: draft[key] || "", onChange: (e) => setDraft({ ...draft, [key]: e.target.value }), placeholder })
    ] });
  }
  if (view === "gate" || view === "verify") return /* @__PURE__ */ jsxs("div", { className: "gate", children: [
    /* @__PURE__ */ jsx(Toaster, { position: "top-center" }),
    /* @__PURE__ */ jsxs("div", { className: "gate-frame", children: [
      /* @__PURE__ */ jsx("div", { className: "stamp", children: "潮" }),
      /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "潮汕方言 · 作品里的日常" }),
      /* @__PURE__ */ jsxs("h1", { children: [
        "潮语",
        /* @__PURE__ */ jsx("span", { children: "入戏" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "gate-sub", children: "从一声家乡话，走进一段故事。" }),
      view === "gate" ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "gate-actions", children: [
          /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => setView("verify"), children: [
            /* @__PURE__ */ jsx(ShieldCheck, { size: 18 }),
            "网站管理员",
            /* @__PURE__ */ jsx(ArrowUpRight, { size: 16 })
          ] }),
          /* @__PURE__ */ jsxs(Button, { onClick: () => run(async () => {
            await api("/api/session", void 0, "DELETE");
            setAdmin(false);
            go("home");
          }), disabled: busy, children: [
            /* @__PURE__ */ jsx(BookOpen, { size: 18 }),
            "潮语探索者",
            /* @__PURE__ */ jsx(ArrowUpRight, { size: 16 })
          ] })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "gate-note", children: "电影与歌曲里的潮语，和它背后的生活。" })
      ] }) : /* @__PURE__ */ jsxs("form", { className: "verify", onSubmit: (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(async () => {
          await api("/api/session", { number: f.get("number"), password: f.get("password") });
          setAdmin(true);
          go("home");
        });
      }, children: [
        /* @__PURE__ */ jsx("h2", { children: "管理员验证" }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "管理员编号" }),
          /* @__PURE__ */ jsx(Input, { name: "number", required: true, autoComplete: "username", placeholder: "请输入管理员编号" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "密码" }),
          /* @__PURE__ */ jsx(Input, { name: "password", required: true, type: "password", autoComplete: "current-password", placeholder: "请输入密码" })
        ] }),
        /* @__PURE__ */ jsx(Button, { disabled: busy, type: "submit", children: busy ? "验证中…" : "确认" }),
        /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", onClick: () => setView("gate"), children: "返回通道选择" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "gate-bottom", children: [
      /* @__PURE__ */ jsx("span", { children: "一字一句，都是故乡。" }),
      /* @__PURE__ */ jsx("span", { children: "CHAOSHAN LANGUAGE / CULTURE" })
    ] })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Toaster, { position: "top-center" }),
    /* @__PURE__ */ jsxs("header", { className: "header", children: [
      /* @__PURE__ */ jsxs("a", { className: "brand", href: "#home", children: [
        /* @__PURE__ */ jsx("span", { className: "brand-seal", children: "潮" }),
        "潮语入戏",
        /* @__PURE__ */ jsx("span", { className: "brand-en", children: "CHAOSHAN IN STORIES" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mode", children: [
        /* @__PURE__ */ jsx("span", { className: "mode-dot" }),
        admin ? "管理员模式" : "潮语探索者",
        /* @__PURE__ */ jsx("button", { onClick: () => run(async () => {
          await api("/api/session", void 0, "DELETE");
          setAdmin(false);
          go("gate");
        }), children: "切换入口" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "nav-wrap", children: [
      /* @__PURE__ */ jsx(Tabs, { value: tab, onValueChange: (v) => {
        setPage(1);
        go(v);
      }, children: /* @__PURE__ */ jsxs(TabsList, { variant: "line", className: "main-tabs", children: [
        /* @__PURE__ */ jsx(TabsTrigger, { value: "home", children: "首页精选" }),
        /* @__PURE__ */ jsx(TabsTrigger, { value: "works", children: "了解作品" }),
        /* @__PURE__ */ jsx(TabsTrigger, { value: "about", children: "关于项目" })
      ] }) }),
      /* @__PURE__ */ jsx("span", { className: "nav-caption", children: "听见潮语，读懂潮汕。" })
    ] }),
    /* @__PURE__ */ jsxs("main", { className: "main", children: [
      error && /* @__PURE__ */ jsxs("div", { className: "service-error", role: "alert", children: [
        error,
        /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: refresh, children: "重新加载" })
      ] }),
      view === "browse" && tab === "home" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "section-heading", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "WORDS IN STORIES / 首页精选" }),
            /* @__PURE__ */ jsxs("h1", { children: [
              "一句潮语，一方生活",
              /* @__PURE__ */ jsx("span", { className: "small-seal", children: "乡音" })
            ] }),
            /* @__PURE__ */ jsx("p", { children: "在电影与歌曲之间，拾起熟悉又新鲜的家乡话。" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "head-actions", children: [
            /* @__PURE__ */ jsxs("div", { className: "search", children: [
              /* @__PURE__ */ jsx(Search, { size: 18 }),
              /* @__PURE__ */ jsx(Input, { "aria-label": "搜索词语、翻译或科普", value: q, placeholder: "搜索词语、翻译或科普…", onChange: (e) => {
                setQ(e.target.value);
                setPage(1);
              } }),
              q && /* @__PURE__ */ jsx("button", { "aria-label": "清空搜索", onClick: () => {
                setQ("");
                setPage(1);
              }, children: "×" })
            ] }),
            admin && /* @__PURE__ */ jsxs(Button, { onClick: () => begin("word"), children: [
              /* @__PURE__ */ jsx(Plus, { size: 16 }),
              "台词添加"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "filters", "aria-label": "选题分类", children: topics.map((t) => /* @__PURE__ */ jsx("button", { "aria-pressed": topic === t, className: topic === t ? "active" : "", onClick: () => {
          setTopic(t);
          setPage(1);
        }, children: t }, t)) }),
        /* @__PURE__ */ jsxs("div", { className: "list-meta", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            q ? "搜索结果" : topic === "全部" ? "全部精选" : topic,
            " ",
            /* @__PURE__ */ jsx("b", { children: filtered.length }),
            " 个词语"
          ] }),
          /* @__PURE__ */ jsx("span", { children: "源于 6 部作品 · 让方言回到语境" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "card-grid", children: filtered.slice((page - 1) * 12, page * 12).map((w, i) => /* @__PURE__ */ jsxs("article", { className: "content-card", children: [
          cover(w, "word", i),
          /* @__PURE__ */ jsxs("a", { className: "card-info", href: "#word/" + w.id, children: [
            /* @__PURE__ */ jsxs("div", { className: "card-label", children: [
              /* @__PURE__ */ jsx("span", { children: w.topic }),
              /* @__PURE__ */ jsx(ArrowUpRight, { size: 18 })
            ] }),
            /* @__PURE__ */ jsx("h2", { children: w.word }),
            /* @__PURE__ */ jsx("p", { children: w.translation.replace(/^.+?：/, "") }),
            /* @__PURE__ */ jsx("div", { className: "card-source", children: data.works.find((x) => x.id === w.workIds?.[0])?.name || "作品出处待补充" })
          ] })
        ] }, w.id)) }),
        !filtered.length && /* @__PURE__ */ jsxs("div", { className: "empty", children: [
          /* @__PURE__ */ jsx(Search, {}),
          /* @__PURE__ */ jsx("h2", { children: "暂时没有找到相关词语" }),
          /* @__PURE__ */ jsx("p", { children: "换个关键词，或选择其他主题试试。" }),
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => {
            setTopic("全部");
            setQ("");
          }, children: "查看全部词语" })
        ] }),
        filtered.length > 12 && /* @__PURE__ */ jsx(Pagination, { className: "pages", children: /* @__PURE__ */ jsx(PaginationContent, { children: Array.from({ length: Math.ceil(filtered.length / 12) }, (_, i) => /* @__PURE__ */ jsx(PaginationItem, { children: /* @__PURE__ */ jsx(PaginationLink, { href: "#home", "aria-label": "第 " + (i + 1) + " 页", isActive: page === i + 1, onClick: (e) => {
          e.preventDefault();
          setPage(i + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, children: i + 1 }) }, i)) }) })
      ] }),
      view === "browse" && tab === "works" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "section-heading", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "FILMS & SONGS / 了解作品" }),
            /* @__PURE__ */ jsx("h1", { children: "故事里，乡音有回响。" }),
            /* @__PURE__ */ jsx("p", { children: "从三部电影、三首歌曲开始，找到词语的来处。" })
          ] }),
          admin && /* @__PURE__ */ jsxs(Button, { onClick: () => begin("work"), children: [
            /* @__PURE__ */ jsx(Plus, { size: 16 }),
            "作品介绍添加"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "list-meta", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            "作品档案 ",
            /* @__PURE__ */ jsx("b", { children: data.works.length }),
            " 部"
          ] }),
          /* @__PURE__ */ jsx("span", { children: "电影与音乐 · 一起走进作品" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "card-grid", children: data.works.map((w, i) => /* @__PURE__ */ jsxs("article", { className: "content-card", children: [
          cover(w, "work", i),
          /* @__PURE__ */ jsxs("a", { className: "card-info", href: "#work/" + w.id, children: [
            /* @__PURE__ */ jsxs("div", { className: "card-label", children: [
              /* @__PURE__ */ jsx("span", { children: w.name.startsWith("歌曲") ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(Music2, { size: 14 }),
                "歌曲"
              ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(Film, { size: 14 }),
                "电影"
              ] }) }),
              /* @__PURE__ */ jsx(ArrowUpRight, { size: 18 })
            ] }),
            /* @__PURE__ */ jsx("h2", { children: w.name.replace(/^(电影|歌曲)《|》$/g, "") }),
            /* @__PURE__ */ jsxs("p", { children: [
              data.words.filter((x) => x.workIds.includes(w.id)).length,
              " 个相关词语"
            ] })
          ] })
        ] }, w.id)) })
      ] }),
      view === "browse" && tab === "about" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "about-top", children: [
          /* @__PURE__ */ jsxs("div", { className: "about-poster", children: [
            data.about.poster ? /* @__PURE__ */ jsx("img", { src: data.about.poster, alt: "关于项目海报" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { children: "潮语入戏" }),
              /* @__PURE__ */ jsx("div", { className: "arch", children: /* @__PURE__ */ jsx(Leaf, { size: 58, strokeWidth: 1 }) }),
              /* @__PURE__ */ jsxs("p", { children: [
                "一字一句",
                /* @__PURE__ */ jsx("br", {}),
                "都是故乡"
              ] }),
              /* @__PURE__ */ jsx("small", { children: "项目海报待补充" })
            ] }),
            admin && fileControl("上传项目海报", "image/*", async (f) => {
              const a = await upload(f);
              await save("about", { ...data.about, poster: a.url });
            })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "about-copy", children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "OUR PROJECT / 关于项目" }),
            /* @__PURE__ */ jsx("h1", { children: data.about.title }),
            admin && /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => {
              setEditField("title");
              setDraft({ ...data.about });
            }, children: [
              /* @__PURE__ */ jsx(Upload, { size: 14 }),
              "上传标题"
            ] }),
            /* @__PURE__ */ jsx("p", { className: "prose", children: data.about.body }),
            admin && /* @__PURE__ */ jsxs(Button, { variant: "outline", onClick: () => {
              setEditField("body");
              setDraft({ ...data.about });
            }, children: [
              /* @__PURE__ */ jsx(Upload, { size: 14 }),
              "上传项目文字"
            ] }),
            editField && /* @__PURE__ */ jsxs("form", { className: "inline-editor", onSubmit: (e) => {
              e.preventDefault();
              run(async () => {
                await save("about", draft);
                setEditField("");
              });
            }, children: [
              field(editField === "title" ? "项目标题" : "项目简介", editField, editField === "body"),
              /* @__PURE__ */ jsx(Button, { disabled: busy, children: "确认保存" }),
              /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", onClick: () => setEditField(""), children: "取消" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "about-note", children: "资料说明：本 Demo 使用上传资料中的释义与文化语境。原声、字幕与正式歌词尚未逐项独立核验；相关校对提示随词条保留。" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "submission", children: admin ? /* @__PURE__ */ jsxs("div", { className: "submission-list", children: [
          /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "INBOX / 收到的投稿" }),
          /* @__PURE__ */ jsx("h2", { children: "来自探索者的乡音线索" }),
          entries.length ? entries.map((x) => /* @__PURE__ */ jsxs("article", { children: [
            /* @__PURE__ */ jsx("h3", { children: x.work }),
            /* @__PURE__ */ jsx("p", { className: "prose", children: x.message }),
            /* @__PURE__ */ jsx("small", { children: new Date(x.created).toLocaleString("zh-CN") })
          ] }, x.id)) : /* @__PURE__ */ jsx("p", { children: "暂未收到投稿。探索者提交后，会在这里显示。" })
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("form", { onSubmit: (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            run(async () => {
              await api("/api/submissions", { work: f.get("work"), message: f.get("message") });
              form.reset();
              toast.success("投稿已收到，感谢分享家乡的声音。");
            });
          }, children: [
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              /* @__PURE__ */ jsx("span", { children: "作品名" }),
              /* @__PURE__ */ jsx(Input, { name: "work", required: true, maxLength: 200, placeholder: "你想推荐哪一部电影或哪一首歌？" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              /* @__PURE__ */ jsx("span", { children: "留言备注" }),
              /* @__PURE__ */ jsx(Textarea, { name: "message", required: true, maxLength: 5e3, rows: 4, placeholder: "写下词语、释义、作品出处，或想与我们分享的故事…" })
            ] }),
            /* @__PURE__ */ jsxs(Button, { disabled: busy, children: [
              "提交投稿",
              /* @__PURE__ */ jsx(ArrowUpRight, { size: 16 })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "submission-title", children: [
            /* @__PURE__ */ jsx("h2", { children: "投稿专区" }),
            /* @__PURE__ */ jsxs("p", { children: [
              "把你听见的潮语",
              /* @__PURE__ */ jsx("br", {}),
              "也留在这里。"
            ] })
          ] })
        ] }) })
      ] }),
      (view === "word" || view === "work") && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("button", { className: "back", onClick: () => go(view === "word" ? "home" : "works"), children: [
          /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }),
          "返回",
          view === "word" ? "首页精选" : "作品列表"
        ] }),
        view === "word" && word ? /* @__PURE__ */ jsxs("article", { className: "reader", children: [
          /* @__PURE__ */ jsxs("div", { className: "reader-heading", children: [
            /* @__PURE__ */ jsx("span", { className: "tag", children: word.topic }),
            /* @__PURE__ */ jsx("h1", { children: word.word }),
            /* @__PURE__ */ jsx("p", { children: word.workIds.map((wid) => /* @__PURE__ */ jsx("a", { href: "#work/" + wid, children: data.works.find((x) => x.id === wid)?.name }, wid)) })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "media-section", children: [
            /* @__PURE__ */ jsxs("div", { className: "block-title", children: [
              /* @__PURE__ */ jsxs("h2", { children: [
                /* @__PURE__ */ jsx(Headphones, { size: 19 }),
                "视听材料"
              ] }),
              admin && /* @__PURE__ */ jsxs("div", { className: "actions", children: [
                fileControl("上传", "audio/*,video/*", async (f) => {
                  const a = await upload(f);
                  await save("word", { ...word, media: a.url, mediaType: a.type });
                }),
                /* @__PURE__ */ jsxs(AlertDialog, { children: [
                  /* @__PURE__ */ jsx(AlertDialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(Button, { disabled: !word.media || busy, variant: "outline", children: [
                    /* @__PURE__ */ jsx(Trash2, { size: 14 }),
                    "删除"
                  ] }) }),
                  /* @__PURE__ */ jsxs(AlertDialogContent, { children: [
                    /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
                      /* @__PURE__ */ jsx(AlertDialogTitle, { children: "删除这条词语的视听材料？" }),
                      /* @__PURE__ */ jsx(AlertDialogDescription, { children: "词语、翻译和科普文字会保留。" })
                    ] }),
                    /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
                      /* @__PURE__ */ jsx(AlertDialogCancel, { children: "取消" }),
                      /* @__PURE__ */ jsx(AlertDialogAction, { onClick: () => run(() => save("word", { ...word, media: "", mediaType: "" })), children: "确认删除" })
                    ] })
                  ] })
                ] })
              ] })
            ] }),
            word.media ? /* @__PURE__ */ jsxs("div", { className: "player", children: [
              word.mediaType.startsWith("video") ? /* @__PURE__ */ jsx("video", { controls: true, preload: "metadata", src: word.media }) : /* @__PURE__ */ jsx("audio", { controls: true, preload: "metadata", src: word.media }),
              /* @__PURE__ */ jsx("a", { href: word.media, target: "_blank", rel: "noreferrer", children: "打开原文件 ↗" })
            ] }) : /* @__PURE__ */ jsxs("div", { className: "media-empty", children: [
              /* @__PURE__ */ jsx(Headphones, { size: 38, strokeWidth: 1 }),
              /* @__PURE__ */ jsx("h3", { children: "这一声乡音，等待被听见。" }),
              /* @__PURE__ */ jsx("p", { children: "原声视频／音频待补充" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "dialect-block", children: [
            /* @__PURE__ */ jsx("span", { className: "eyebrow", children: "01 / 潮语" }),
            /* @__PURE__ */ jsx("h2", { children: word.dialect })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "reading-block", children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "02 / 普通话翻译" }),
            /* @__PURE__ */ jsx("p", { className: "translation", children: word.translation })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "reading-block", children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "03 / 语境与文化科普" }),
            /* @__PURE__ */ jsx("p", { className: "prose", children: word.intro }),
            word.note && /* @__PURE__ */ jsxs("aside", { className: "proof-note", children: [
              /* @__PURE__ */ jsx("b", { children: "校对提示" }),
              /* @__PURE__ */ jsx("p", { children: word.note })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "source-note", children: "来源：用户提供的《潮汕方言网站科普资料》。具体原声、字幕及正式歌词待核验。" })
          ] })
        ] }) : view === "work" && work ? /* @__PURE__ */ jsxs("article", { className: "work-reader", children: [
          /* @__PURE__ */ jsxs("div", { className: "work-top", children: [
            cover(work, "work", data.works.indexOf(work)),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "WORK ARCHIVE / 作品档案" }),
              /* @__PURE__ */ jsx("h1", { children: work.name.replace(/^(电影|歌曲)《|》$/g, "") }),
              /* @__PURE__ */ jsx("h2", { children: "基础信息" }),
              /* @__PURE__ */ jsx("p", { className: "prose", children: work.basic })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "reading-block", children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "深入介绍" }),
            /* @__PURE__ */ jsx("p", { className: "prose", children: work.intro })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "reading-block", children: [
            /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "作品中的潮语" }),
            /* @__PURE__ */ jsx("div", { className: "related", children: data.words.filter((w) => w.workIds.includes(work.id)).map((w) => /* @__PURE__ */ jsxs("a", { href: "#word/" + w.id, children: [
              w.word,
              /* @__PURE__ */ jsx(ArrowUpRight, { size: 14 })
            ] }, w.id)) })
          ] })
        ] }) : /* @__PURE__ */ jsx("div", { className: "empty", children: "没有找到这条内容" })
      ] }),
      (view === "add-word" || view === "add-work") && (admin ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("button", { className: "back", onClick: () => go(view === "add-word" ? "home" : "works"), children: [
          /* @__PURE__ */ jsx(ArrowLeft, { size: 16 }),
          "返回列表"
        ] }),
        /* @__PURE__ */ jsxs("form", { className: "editor", onSubmit: (e) => {
          e.preventDefault();
          run(async () => {
            const kind = view === "add-word" ? "word" : "work";
            if (kind === "work" && !draft.poster) throw Error("请上传作品海报");
            await save(kind, draft);
            go(kind === "word" ? "home" : "works");
          });
        }, children: [
          /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "CONTRIBUTE / 管理员专属" }),
          /* @__PURE__ */ jsx("h1", { children: view === "add-word" ? "添加一条潮语" : "添加作品介绍" }),
          /* @__PURE__ */ jsx("p", { children: "保存后会直接出现在对应列表中。" }),
          view === "add-word" ? /* @__PURE__ */ jsxs(Fragment, { children: [
            field("01 · 词语", "word", false, "首页卡片显示的词语"),
            /* @__PURE__ */ jsxs("div", { className: "field", children: [
              /* @__PURE__ */ jsx("span", { children: "02 · 视听材料" }),
              fileControl("选择视频或音频", "audio/*,video/*", async (f) => {
                const a = await upload(f);
                setDraft((d) => ({ ...d, media: a.url, mediaType: a.type }));
              }),
              /* @__PURE__ */ jsx("small", { children: draft.media ? "已上传视听材料" : "没有原声时可暂不上传，显示“待补充”。" })
            ] }),
            field("03 · 潮语", "dialect"),
            field("04 · 翻译", "translation", true),
            field("05 · 科普", "intro", true),
            /* @__PURE__ */ jsxs("label", { className: "field", children: [
              /* @__PURE__ */ jsx("span", { children: "06 · 选题" }),
              /* @__PURE__ */ jsx(Input, { required: true, list: "topic-options", value: draft.topic, onChange: (e) => setDraft({ ...draft, topic: e.target.value }), placeholder: "选择已有主题，或填写新主题" }),
              /* @__PURE__ */ jsx("datalist", { id: "topic-options", children: topics.slice(1).map((t) => /* @__PURE__ */ jsx("option", { value: t }, t)) }),
              /* @__PURE__ */ jsx("small", { children: "新的选题会自动加入首页分类栏。" })
            ] }),
            /* @__PURE__ */ jsx(Button, { disabled: busy, type: "submit", children: busy ? "保存中…" : "确认上传" })
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("div", { className: "field", children: [
              /* @__PURE__ */ jsx("span", { children: "01 · 作品海报" }),
              fileControl("选择图片", "image/*", async (f) => {
                const a = await upload(f);
                setDraft((d) => ({ ...d, poster: a.url }));
              }),
              draft.poster && /* @__PURE__ */ jsx("img", { className: "preview-poster", src: draft.poster, alt: "已选择的作品海报" })
            ] }),
            field("02 · 作品名", "name"),
            field("03 · 基础信息", "basic", true, "发行时间、导演／作者、演员／演唱者"),
            field("04 · 深入介绍", "intro", true),
            /* @__PURE__ */ jsx(Button, { disabled: busy, type: "submit", children: busy ? "保存中…" : "确认" })
          ] })
        ] })
      ] }) : /* @__PURE__ */ jsx("div", { className: "empty", children: "请先通过管理员入口验证。" }))
    ] }),
    /* @__PURE__ */ jsxs("footer", { className: "footer", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("span", { className: "brand-seal", children: "潮" }),
        /* @__PURE__ */ jsx("b", { children: "潮语入戏" }),
        /* @__PURE__ */ jsx("span", { children: "在故事里听乡音，在乡音里读生活。" })
      ] }),
      /* @__PURE__ */ jsx("p", { children: "内容来源于整理资料 · 缺失内容待补充" })
    ] })
  ] });
}
export {
  Explorer as default
};
