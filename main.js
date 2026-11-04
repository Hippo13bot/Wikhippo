// Wikhippo — par @hippo.reporter
const { app, BrowserWindow, ipcMain, safeStorage, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const FILE = () => path.join(app.getPath("userData"), "wikhippo.json");
const load = () => { try { return JSON.parse(fs.readFileSync(FILE(), "utf8")); } catch { return { courses: [], settings: {} }; } };
const store = (d) => fs.writeFileSync(FILE(), JSON.stringify(d));
const enc = (s) => safeStorage.isEncryptionAvailable() ? "e:" + safeStorage.encryptString(s).toString("base64") : "p:" + Buffer.from(s).toString("base64");
const dec = (s) => !s ? "" : s.startsWith("e:") ? safeStorage.decryptString(Buffer.from(s.slice(2), "base64")) : Buffer.from(s.slice(2), "base64").toString();
const secret = (k) => dec((load().settings || {})[k]);
const pub = (s) => ({ model: s.model || "", notionParent: s.notionParent || "", notionDb: s.notionDb || "", hasKey: !!s.apiKey, hasNotion: !!s.notionToken });

function createWindow() {
  const w = new BrowserWindow({
    width: 1120, height: 800, minWidth: 820, minHeight: 600, title: "Wikhippo", icon: path.join(__dirname, "src", "logo.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  w.loadFile(path.join(__dirname, "src", "index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

ipcMain.handle("load", () => { const d = load(); return { courses: d.courses || [], settings: pub(d.settings || {}) }; });
ipcMain.handle("save", (_, courses) => { const d = load(); d.courses = courses; store(d); return true; });
ipcMain.handle("settings", (_, s) => {
  const d = load(); d.settings = d.settings || {};
  for (const k of ["apiKey", "notionToken"]) if (s[k]) d.settings[k] = enc(s[k]);
  for (const k of ["model", "notionParent", "notionDb"]) if (k in s) d.settings[k] = s[k];
  store(d); return pub(d.settings);
});

// ---- IA (API Anthropic, clé stockée chiffrée sur l'ordinateur) ----
ipcMain.handle("ai", async (_, { prompt, system, max }) => {
  const key = secret("apiKey");
  if (!key) return { error: "no_key" };
  const model = (load().settings || {}).model || "claude-sonnet-5-5";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: max || 4000, system, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) return { error: (j.error && j.error.message) || "HTTP " + r.status };
    return { text: j.content.filter((b) => b.type === "text").map((b) => b.text).join("") };
  } catch (e) { return { error: String(e.message || e) }; }
});

// ---- Export PDF ----
ipcMain.handle("pdf", async (_, { html, name }) => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  const buf = await w.webContents.printToPDF({ pageSize: "A4", printBackground: true });
  w.destroy();
  const r = await dialog.showSaveDialog({ defaultPath: name.replace(/[\\/:*?"<>|]/g, "-") + ".pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (r.canceled) return { canceled: true };
  fs.writeFileSync(r.filePath, buf); shell.showItemInFolder(r.filePath);
  return { path: r.filePath };
});

// ---- Notion (jeton d'intégration interne) ----
const nid = (s) => (String(s || "").replace(/-/g, "").match(/[0-9a-f]{32}/i) || [])[0];
async function nfetch(p, method = "GET", body) {
  const t = secret("notionToken");
  if (!t) throw new Error("Ajoute ton jeton Notion dans Réglages.");
  const r = await fetch("https://api.notion.com/v1" + p, {
    method, headers: { Authorization: "Bearer " + t, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || "Notion HTTP " + r.status);
  return j;
}
const rt = (a) => (a || []).map((x) => x.plain_text).join("");
async function blocksText(id, depth = 0) {
  let out = "", cur;
  do {
    const j = await nfetch(`/blocks/${id}/children?page_size=100` + (cur ? "&start_cursor=" + cur : ""));
    for (const b of j.results) {
      const t = rt((b[b.type] || {}).rich_text);
      const pre = { heading_1: "# ", heading_2: "## ", heading_3: "### ", bulleted_list_item: "- ", numbered_list_item: "1. ", quote: "> ", to_do: "- " }[b.type] || "";
      if (t) out += pre + t + "\n";
      if (b.has_children && depth < 2 && !b.type.startsWith("child_")) out += await blocksText(b.id, depth + 1);
    }
    cur = j.has_more ? j.next_cursor : null;
  } while (cur);
  return out;
}
ipcMain.handle("notion:import", async (e, url) => {
  try {
    const id = nid(url); if (!id) throw new Error("Lien de base Notion invalide.");
    const rows = []; let cur;
    do {
      const j = await nfetch(`/databases/${id}/query`, "POST", { page_size: 100, ...(cur ? { start_cursor: cur } : {}) });
      rows.push(...j.results); cur = j.has_more ? j.next_cursor : null;
    } while (cur && rows.length < 500);
    const pages = []; let n = 0;
    for (const p of rows) {
      const props = Object.values(p.properties);
      const title = rt((props.find((x) => x.type === "title") || {}).title) || "Sans titre";
      const sel = p.properties["Matière"] || p.properties.Matiere || props.find((x) => x.type === "select");
      const group = sel && sel.select ? sel.select.name : "Sans matière";
      e.sender.send("progress", `Lecture ${++n}/${rows.length} : ${title}`);
      const text = (await blocksText(p.id)).trim();
      if (text.length >= 50) pages.push({ title, group, text });
    }
    return { pages };
  } catch (err) { return { error: err.message }; }
});
function rich(s) {
  const parts = [];
  s.split(/(\*\*.+?\*\*)/).forEach((x) => {
    if (!x) return;
    const b = /^\*\*.+\*\*$/.test(x), t = b ? x.slice(2, -2) : x;
    for (let i = 0; i < t.length; i += 1900) parts.push({ type: "text", text: { content: t.slice(i, i + 1900) }, ...(b ? { annotations: { bold: true } } : {}) });
  });
  return parts.length ? parts : [{ type: "text", text: { content: " " } }];
}
function toBlocks(md) {
  const out = [];
  for (const raw of md.split("\n")) {
    const l = raw.trim(); if (!l) continue; let m;
    const blk = (type, t) => out.push({ object: "block", type, [type]: { rich_text: rich(t) } });
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) blk("heading_" + m[1].length, m[2]);
    else if ((m = l.match(/^[-*]\s+(.*)/))) blk("bulleted_list_item", m[1]);
    else if ((m = l.match(/^\d+[.)]\s+(.*)/))) blk("numbered_list_item", m[1]);
    else if ((m = l.match(/^>\s?(.*)/))) blk("quote", m[1]);
    else if (/^---+$/.test(l)) out.push({ object: "block", type: "divider", divider: {} });
    else blk("paragraph", l);
  }
  return out;
}
ipcMain.handle("notion:export", async (_, { title, md }) => {
  try {
    const pid = nid((load().settings || {}).notionParent);
    if (!pid) throw new Error("Indique la page Notion de destination dans Réglages.");
    const bl = toBlocks(md);
    const page = await nfetch("/pages", "POST", { parent: { page_id: pid }, properties: { title: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] } }, children: bl.slice(0, 100) });
    for (let i = 100; i < bl.length; i += 100) await nfetch(`/blocks/${page.id}/children`, "PATCH", { children: bl.slice(i, i + 100) });
    return { url: page.url };
  } catch (e) { return { error: e.message }; }
});
