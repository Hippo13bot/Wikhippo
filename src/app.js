// Wikhippo — par @hippo.reporter
pdfjsLib.GlobalWorkerOptions.workerSrc = "../node_modules/pdfjs-dist/build/pdf.worker.min.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
function md2html(md) {
  const out = []; let list = null; const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split("\n")) {
    const l = raw.trimEnd(); let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); out.push(`<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`); }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inl(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inl(m[1])}</li>`); }
    else if ((m = l.match(/^>\s?(.*)/))) { close(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); }
    else if (/^---+$/.test(l)) { close(); out.push("<hr>"); }
    else { close(); out.push(`<p>${inl(l)}</p>`); }
  }
  close(); return out.join("");
}
const INT = [0, 1, 2, 4, 8, 16, 32], day = () => Math.floor(Date.now() / 864e5);
const MODES = { complete: ["Complète", "fiche structurée complète (2 à 3 pages)"], express: ["Express", "1 page maximum, uniquement l’indispensable"], exam: ["Examen", "orientée examen : définitions exactes, pièges, questions probables avec réponses"] };
const TEMPLATE = `# <Titre>
> Résumé en 2 phrases.
## L’essentiel
(5 à 8 puces)
## Définitions clés
- **Terme** : définition courte
## Dates, chiffres, noms propres
## Mécanismes et liens (cause → effet)
## Pièges et confusions fréquentes
## Questions d’examen probables
(3 à 5 questions, réponse en une phrase)
## Mémo éclair
(3 lignes à relire la veille)`;
const SYS = "Tu es un tuteur exigeant et bienveillant pour une étudiante ou un étudiant en école d’audiovisuel. Tu réponds toujours en français, tu restes fidèle au cours fourni et tu n’inventes rien.";

let D = { courses: [], settings: {} }, V = { v: "home" }, busy = "", nmsg = "", Q = [], shown = false, quiz = null, oral = null, edit = false;
const cur = () => D.courses.find((c) => c.id === V.id);
const curSheet = () => cur().sheets.find((s) => s.id === V.sid);
const due = (c) => c.cards.filter((k) => k.due <= day());
const save = () => api.save(D.courses);
const src = (c) => (c.sheets[0] ? c.sheets[0].md : c.docs.map((d) => d.text).join("\n\n").slice(0, 20000));
const hasSrc = (c) => c.docs.length || c.sheets.length;
function toast(t) { const e = $("#st"); e.textContent = t; e.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => (e.style.display = "none"), 4000); }
async function ai(prompt, max) {
  const r = await api.ai({ prompt, max, system: SYS });
  if (r.error) { toast(r.error === "no_key" ? "Ajoute ta clé API Anthropic dans Réglages." : "Erreur IA : " + r.error); throw new Error(r.error); }
  return r.text;
}
const J = (t) => { const m = t.match(/[\[{][\s\S]*[\]}]/); return JSON.parse(m ? m[0] : t); };
const uid = () => "i" + Date.now() + Math.floor(Math.random() * 1e4);
const newCourse = (name) => { const c = { id: uid(), name, docs: [], cards: [], sheets: [] }; D.courses.push(c); return c; };

(async () => {
  D = await api.load();
  D.courses.forEach((c) => { c.docs = c.docs || []; c.cards = c.cards || []; c.sheets = c.sheets || []; });
  api.onProgress((m) => { nmsg = m; if (V.v === "home") render(); });
  render();
})();

function render() {
  const a = $("#app");
  a.innerHTML = { home, course, sheetV, review, quizV, oralV }[V.v]();
  $("#st").style.display = busy ? "block" : "none"; if (busy) $("#st").textContent = busy;
}

function home() {
  const list = D.courses.map((c) => `<div class="card click" data-a="open" data-id="${c.id}"><b>${esc(c.name)}</b><div class="tag">${c.docs.length} document(s), ${c.sheets.length} fiche(s), ${c.cards.length} cartes, ${due(c).length} à revoir</div></div>`).join("");
  return `<h1>Mes matières</h1>
  <div class="row"><input id="nc" placeholder="Nouvelle matière"><button class="p" data-a="addcourse">Ajouter</button></div>
  <div class="card"><b>Importer depuis Notion</b><div class="row" style="margin-top:8px"><input id="nurl" value="${esc(D.settings.notionDb || "")}" placeholder="Lien de ta base de cours Notion"><button data-a="nimport" ${busy ? "disabled" : ""}>Importer</button></div>${nmsg ? `<p class="tag">${esc(nmsg)}</p>` : ""}</div>
  ${list || '<p class="tag">Aucune matière pour l’instant. Ajoutes-en une, ou importe ta base Notion.</p>'}`;
}
function course() {
  const c = cur(), d = due(c).length, m = c.cards.filter((k) => k.box >= 4).length, off = busy || !hasSrc(c) ? "disabled" : "";
  return `<a class="back" data-a="home">← Matières</a><h1>${esc(c.name)}</h1>
  <p class="tag">${c.cards.length} cartes, ${d} à revoir aujourd’hui, ${m} bien maîtrisées</p>
  <div class="row" style="margin-top:8px"><button class="p" data-a="review" ${d ? "" : "disabled"}>Réviser les cartes (${d})</button><button data-a="quiz" ${off}>Quiz QCM</button><button data-a="oral" ${off}>Explique avec tes mots</button><button data-a="gencards" ${off}>Créer des cartes</button></div>
  <h2>Fiches de synthèse</h2>
  <div class="card"><div class="row"><select id="sdoc"><option value="all">Toute la matière</option>${c.docs.map((x, i) => `<option value="${i}">${esc(x.name)}</option>`).join("")}</select><select id="smode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select><button class="p" data-a="mksheet" ${busy || !c.docs.length ? "disabled" : ""}>Créer la fiche</button></div></div>
  ${c.sheets.map((s) => `<div class="card click" data-a="opensheet" data-id="${s.id}"><b>${esc(s.title)}</b><div class="tag">${MODES[s.mode][0]}, ${s.date}</div></div>`).join("")}
  <h2>Cours</h2>
  <div class="drop">Glisse des PDF ici ou <label style="text-decoration:underline;cursor:pointer">choisis des fichiers<input type="file" id="pdfs" accept="application/pdf" multiple hidden></label></div>
  ${c.docs.map((x, i) => `<div class="row" style="margin-top:6px"><span class="sp">${esc(x.name)} <span class="tag">${Math.round(x.text.length / 1000)}k car.</span></span><button class="bad" data-a="deldoc" data-i="${i}">Retirer</button></div>`).join("")}
  <div class="row" style="margin-top:28px"><button class="bad" data-a="delcourse">Supprimer la matière</button></div>`;
}
function sheetV() {
  const c = cur(), s = curSheet();
  return `<a class="back" data-a="open" data-id="${c.id}">← ${esc(c.name)}</a>
  <div class="row" style="margin:12px 0"><button class="p" data-a="pdf">Exporter en PDF</button><button data-a="notion">Envoyer vers Notion</button><button data-a="copy">Copier</button><button data-a="cardsfrom">Créer des cartes</button><button data-a="toggle">${edit ? "Aperçu" : "Modifier"}</button><span class="sp"></span><button class="bad" data-a="delsheet">Supprimer</button></div>
  ${edit ? `<textarea id="ed">${esc(s.md)}</textarea><div class="row" style="margin-top:8px"><button class="p" data-a="savesheet">Enregistrer</button></div>` : `<div class="card sheet">${md2html(s.md)}</div>`}`;
}
function review() {
  const c = cur();
  if (!Q.length) return `<a class="back" data-a="open" data-id="${c.id}">← ${esc(c.name)}</a><div class="card big">Terminé pour aujourd’hui.</div>`;
  const k = Q[0];
  return `<a class="back" data-a="open" data-id="${c.id}">← ${esc(c.name)}</a><p class="tag" style="margin-top:12px">${Q.length} carte(s) restante(s). Raccourcis : espace, puis 1 / 2 / 3</p>
  <div class="card"><div class="big">${esc(k.q)}</div>${shown ? `<hr><div class="big">${esc(k.a)}</div>` : ""}</div>
  <div class="row">${shown ? `<button class="bad sp" data-a="grade" data-g="0">1 · Raté</button><button class="sp" data-a="grade" data-g="1">2 · Difficile</button><button class="sp" data-a="grade" data-g="2">3 · Facile</button>` : `<button class="p sp" data-a="show">Voir la réponse</button>`}</div>`;
}
function quizV() {
  const c = cur(), q = quiz, back = `<a class="back" data-a="open" data-id="${c.id}">← ${esc(c.name)}</a>`;
  if (q.i >= q.items.length) return `${back}<div class="card big">Score : ${q.ok} / ${q.items.length}${q.wrong ? `\n${q.wrong} erreur(s) ajoutée(s) à tes cartes pour y revenir.` : ""}</div>`;
  const it = q.items[q.i], done = q.pick != null;
  return `${back}<div class="bar"><i style="width:${(q.i / q.items.length) * 100}%"></i></div><p class="tag">Question ${q.i + 1} / ${q.items.length}</p>
  <div class="card"><b>${esc(it.q)}</b>${it.c.map((t, i) => `<button class="ch ${done ? (i === it.a ? "good" : i === q.pick ? "wrong" : "") : ""}" data-a="pick" data-i="${i}">${esc(t)}</button>`).join("")}${done ? `<p>${esc(it.e)}</p><button class="p" data-a="qnext">Suivante</button>` : ""}</div>`;
}
function oralV() {
  const c = cur(), o = oral, back = `<a class="back" data-a="open" data-id="${c.id}">← ${esc(c.name)}</a>`;
  return `${back}<h2>Explique avec tes mots</h2><div class="card"><b>${esc(o.q)}</b>
  ${o.fb ? `<p><b>Note : ${esc(o.fb.score)} / 10</b></p><p><b>Bien vu</b></p><ul>${(o.fb.ok || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p><b>À compléter</b></p><ul>${(o.fb.missing || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p><b>Réponse modèle</b></p><p>${esc(o.fb.model)}</p><button class="p" data-a="oral">Autre question</button>`
    : `<textarea id="oa" style="min-height:160px;margin-top:10px" placeholder="Explique comme si tu parlais à quelqu’un qui découvre le sujet…"></textarea><div class="row" style="margin-top:8px"><button class="p" data-a="oralsend">Corriger ma réponse</button></div>`}</div>`;
}

// ---------- fabrication ----------
async function addPdfs(files) {
  const c = cur();
  for (const f of files) {
    busy = "Lecture de " + f.name + "…"; render();
    try {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise; let t = "";
      for (let i = 1; i <= pdf.numPages; i++) { const x = await (await pdf.getPage(i)).getTextContent(); t += x.items.map((i) => i.str).join(" ") + "\n"; }
      t = t.replace(/[ \t]+/g, " ").trim();
      if (t.length < 50) toast(f.name + " : aucun texte lisible (PDF scanné ?)"); else c.docs.push({ name: f.name, text: t.slice(0, 200000) });
    } catch (e) { toast("Impossible de lire " + f.name); }
  }
  busy = ""; save(); render();
}
async function makeSheet(mode, which) {
  const c = cur(), docs = which === "all" ? c.docs : [c.docs[+which]];
  const text = docs.map((d) => "## " + d.name + "\n" + d.text).join("\n\n"), parts = [];
  for (let i = 0; i < text.length && parts.length < 12; i += 12000) parts.push(text.slice(i, i + 12000));
  try {
    let notes = parts[0];
    if (parts.length > 1) {
      const n = [];
      for (let i = 0; i < parts.length; i++) { busy = `Lecture du cours ${i + 1}/${parts.length}…`; render(); n.push(await ai("Extrais de ce passage de cours les notes essentielles (définitions exactes, dates, chiffres, noms, mécanismes, exemples clés) en puces concises :\n\n" + parts[i], 1800)); }
      notes = n.join("\n\n");
    }
    busy = "Rédaction de la fiche…"; render();
    const md = (await ai(`Format : ${MODES[mode][1]}.\nÀ partir de ces notes de cours, rédige UNE fiche de synthèse en Markdown qui suit ce gabarit (garde les titres, adapte le contenu, retire une section seulement si elle n’a rien à dire) :\n\n${TEMPLATE}\n\nRègles : phrases courtes, **gras** pour les termes à retenir, rien d’inventé.\n\nNOTES :\n${notes}`, mode === "express" ? 1500 : 4000)).trim();
    const t = (md.match(/^#\s+(.+)/m) || [])[1] || (which === "all" ? c.name : docs[0].name);
    const s = { id: uid(), title: t.replace(/[<>]/g, ""), mode, md, date: new Date().toLocaleDateString("fr-FR") };
    c.sheets.unshift(s); save(); V = { v: "sheet", id: c.id, sid: s.id }; edit = false;
  } catch (e) {}
  busy = ""; render();
}
async function makeCards(md) {
  const c = cur(); busy = "Création des cartes…"; render();
  try {
    const r = J(await ai(`Écris 12 flashcards à partir de ce cours : questions précises, réponses courtes (1 à 3 phrases), centrées sur l’essentiel. Réponds uniquement par un tableau JSON [{"q":"...","a":"..."}].\n\n${md}`, 3000));
    const have = new Set(c.cards.map((k) => k.q.toLowerCase())); let n = 0;
    for (const k of r) if (k.q && k.a && !have.has(String(k.q).toLowerCase())) { c.cards.push({ q: String(k.q), a: String(k.a), box: 0, due: day() }); n++; }
    save(); toast(n + " cartes ajoutées");
  } catch (e) {}
  busy = ""; render();
}
async function startQuiz() {
  const c = cur(); busy = "Préparation du quiz…"; render();
  try {
    const items = J(await ai(`Écris 10 questions à choix multiples (4 choix, une seule bonne réponse, mauvaises réponses plausibles) sur ce cours. Réponds uniquement par un tableau JSON [{"q":"...","c":["...","...","...","..."],"a":0,"e":"explication courte"}] où "a" est l’index (0 à 3) de la bonne réponse.\n\n${src(c)}`, 4000));
    quiz = { items: items.filter((x) => x.q && Array.isArray(x.c) && x.c.length > 1 && x.c[x.a] != null), i: 0, ok: 0, wrong: 0, pick: null };
    V.v = "quiz";
  } catch (e) {}
  busy = ""; render();
}
async function nextOral() {
  const c = cur(); busy = "Choix d’une question…"; render();
  try { const q = await ai(`Pose UNE question ouverte de compréhension (pas une définition par cœur) sur un point important de ce cours. Réponds uniquement par la question.\nPoint à éviter : ${oral ? oral.q : "aucun"}\n\n${src(c)}`, 200); oral = { q: q.trim(), fb: null }; V.v = "oral"; } catch (e) {}
  busy = ""; render();
}
async function gradeOral() {
  const c = cur(), a = $("#oa").value.trim(); if (a.length < 5) return;
  busy = "Correction…"; render();
  try { oral.fb = J(await ai(`Question : ${oral.q}\nRéponse de l’étudiant : ${a}\n\nCorrige d’après le cours ci-dessous. Réponds uniquement en JSON {"score":0-10,"ok":["points justes"],"missing":["points manquants ou faux"],"model":"réponse modèle en 3 à 5 phrases"}.\n\nCOURS :\n${src(c)}`, 1500)); } catch (e) {}
  busy = ""; render();
}
function pdfHtml(s, c) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><style>@page{margin:18mm}body{font:11pt/1.55 Georgia,"Times New Roman",serif;color:#14171f}h1{font:800 20pt/1.2 system-ui,sans-serif;border-bottom:2px solid #2b4cff;padding-bottom:6px}h2{font:700 13pt system-ui,sans-serif;color:#2b4cff;margin:18px 0 6px;break-after:avoid}h3{font:700 11pt system-ui,sans-serif}ul,ol{margin:4px 0 8px 18px;padding:0}li{margin:2px 0}blockquote{margin:8px 0;padding:6px 12px;background:#eef1ff;border-left:3px solid #2b4cff}code{background:#eee;padding:0 3px}hr{border:0;border-top:1px solid #ccc}.m,.f{font:9pt system-ui,sans-serif;color:#777}.f{margin-top:24px;border-top:1px solid #ddd;padding-top:6px}</style><body><div class="m">${esc(c.name)}</div>${md2html(s.md)}<div class="f">Wikhippo, par @hippo.reporter</div></body></html>`;
}
function putNotion(pages) {
  let n = 0; const g = new Set();
  for (const p of pages) {
    let c = D.courses.find((x) => x.name === p.group) || newCourse(p.group);
    const d = { name: p.title, text: p.text.slice(0, 200000), src: "notion" }, k = c.docs.findIndex((x) => x.name === p.title && x.src === "notion");
    if (k >= 0) c.docs[k] = d; else c.docs.push(d); n++; g.add(p.group);
  }
  return `${n} page(s) importée(s) dans ${g.size} matière(s).`;
}

// ---------- événements ----------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-a]"); if (!t) return;
  const a = t.dataset.a, c = V.id ? cur() : null;
  if (a === "home") { V = { v: "home" }; render(); }
  else if (a === "open") { V = { v: "course", id: t.dataset.id || V.id }; render(); }
  else if (a === "addcourse") { const n = $("#nc").value.trim(); if (!n) return; const c2 = newCourse(n); save(); V = { v: "course", id: c2.id }; render(); }
  else if (a === "nimport") {
    const u = $("#nurl").value.trim(); if (!u) return;
    busy = "Import Notion…"; nmsg = ""; render(); await api.settings({ notionDb: u }); D.settings.notionDb = u;
    const r = await api.nImport(u); busy = "";
    if (r.error) nmsg = r.error; else { nmsg = putNotion(r.pages); save(); }
    render();
  }
  else if (a === "deldoc") { c.docs.splice(+t.dataset.i, 1); save(); render(); }
  else if (a === "delcourse") { if (confirm("Supprimer cette matière, ses fiches et ses cartes ?")) { D.courses = D.courses.filter((x) => x.id !== c.id); save(); V = { v: "home" }; render(); } }
  else if (a === "mksheet") makeSheet($("#smode").value, $("#sdoc").value);
  else if (a === "opensheet") { V = { v: "sheet", id: c.id, sid: t.dataset.id }; edit = false; render(); }
  else if (a === "toggle") { edit = !edit; render(); }
  else if (a === "savesheet") { curSheet().md = $("#ed").value; save(); edit = false; render(); }
  else if (a === "delsheet") { if (confirm("Supprimer cette fiche ?")) { c.sheets = c.sheets.filter((s) => s.id !== V.sid); save(); V = { v: "course", id: c.id }; render(); } }
  else if (a === "copy") { await navigator.clipboard.writeText(curSheet().md); toast("Fiche copiée"); }
  else if (a === "pdf") { const s = curSheet(), r = await api.pdf({ html: pdfHtml(s, c), name: s.title }); if (r.path) toast("PDF enregistré"); }
  else if (a === "notion") {
    if (!D.settings.hasNotion || !D.settings.notionParent) { openSettings(); toast("Renseigne ton jeton Notion et la page de destination."); return; }
    const s = curSheet(); busy = "Envoi vers Notion…"; render();
    const r = await api.nExport({ title: s.title, md: s.md + "\n\n---\nCréé avec Wikhippo, par @hippo.reporter" }); busy = ""; render();
    toast(r.error ? r.error : "Fiche envoyée dans Notion");
  }
  else if (a === "cardsfrom") makeCards(curSheet().md);
  else if (a === "gencards") makeCards(src(c));
  else if (a === "review") { Q = due(c).sort(() => Math.random() - 0.5); shown = false; V.v = "review"; render(); }
  else if (a === "show") { shown = true; render(); }
  else if (a === "grade") grade(+t.dataset.g);
  else if (a === "quiz") startQuiz();
  else if (a === "pick") {
    if (quiz.pick != null) return; const it = quiz.items[quiz.i]; quiz.pick = +t.dataset.i;
    if (quiz.pick === it.a) quiz.ok++; else { quiz.wrong++; c.cards.push({ q: it.q, a: it.c[it.a] + ". " + it.e, box: 0, due: day() }); save(); }
    render();
  }
  else if (a === "qnext") { quiz.i++; quiz.pick = null; render(); }
  else if (a === "oral") nextOral();
  else if (a === "oralsend") gradeOral();
});
function grade(g) {
  const k = Q.shift();
  if (g === 0) { k.box = 1; k.due = day() + 1; Q.push(k); }
  else if (g === 1) { k.box = Math.max(1, k.box); k.due = day() + INT[k.box]; }
  else { k.box = Math.min(6, k.box + 1); k.due = day() + INT[k.box]; }
  shown = false; save(); render();
}
document.addEventListener("keydown", (e) => {
  if (V.v !== "review" || !Q.length || /TEXTAREA|INPUT/.test(e.target.tagName)) return;
  if (!shown && (e.code === "Space" || e.key === "Enter")) { e.preventDefault(); shown = true; render(); }
  else if (shown && "123".includes(e.key)) grade(+e.key - 1);
});
document.addEventListener("change", (e) => { if (e.target.id === "pdfs") addPdfs([...e.target.files]); });
document.addEventListener("dragover", (e) => { if (V.v === "course") e.preventDefault(); });
document.addEventListener("drop", (e) => { if (V.v === "course") { e.preventDefault(); addPdfs([...e.dataTransfer.files].filter((f) => f.type === "application/pdf")); } });
function openSettings() {
  $("#kst").textContent = D.settings.hasKey ? "(enregistrée)" : ""; $("#tst").textContent = D.settings.hasNotion ? "(enregistré)" : "";
  $("#k").value = ""; $("#t").value = ""; $("#m").value = D.settings.model || ""; $("#pp").value = D.settings.notionParent || ""; $("#dlg").showModal();
}
$("#set").onclick = openSettings; $("#x").onclick = () => $("#dlg").close(); $("#home").onclick = () => { V = { v: "home" }; render(); };
$("#sv").onclick = async () => { D.settings = await api.settings({ apiKey: $("#k").value.trim(), notionToken: $("#t").value.trim(), model: $("#m").value.trim(), notionParent: $("#pp").value.trim() }); $("#dlg").close(); toast("Réglages enregistrés"); };
