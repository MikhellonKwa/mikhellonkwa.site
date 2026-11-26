import { getClient, h, safeUrl, projectUrl } from "./db.js";
import { setupChrome, reveal, paragraphs, renderSidebar, initDrawer, maintenanceGate } from "./site.js";

const app = document.getElementById("app");
initDrawer();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Halaman ini dipakai untuk:
//   /project/<slug>          (alamat utama, dilayani lewat 404.html di GitHub Pages)
//   /project.html?id=<uuid>  (alamat lama, otomatis diganti ke alamat utama)
// Alamat lain yang tidak ada → "Halaman tidak ditemukan".
function route() {
  const m = location.pathname.match(/^\/project\/([^/]+)\/?$/);
  if (m) return { slug: decodeURIComponent(m[1]) };
  const id = new URLSearchParams(location.search).get("id");
  if (/\/project(\.html)?$/.test(location.pathname) && id) return { id };
  return {};
}

async function load() {
  const r = route();
  const sb = await getClient();
  // id yang salah format → error dari database → dianggap "tidak ditemukan"
  const byId = id => sb.from("projects").select("*").eq("id", id).maybeSingle();
  const [prof, first] = await Promise.all([
    sb.from("profile").select("*").eq("id", 1).maybeSingle(),
    r.slug ? sb.from("projects").select("*").eq("slug", r.slug).maybeSingle()
      : r.id ? byId(r.id) : Promise.resolve({ data: null }),
  ]);
  let proj = first;
  // /project/<uuid> juga diterima
  if (r.slug && !proj.data && UUID.test(r.slug)) proj = await byId(r.slug);
  return { profile: prof.data || {}, project: proj.error ? null : proj.data, route: r };
}

// ---------- Blok konten ----------
const figure = (media, caption) =>
  h("figure", { class: "b-fig" }, media, caption ? h("figcaption", {}, caption) : null);

const img = (url, alt = "") =>
  h("img", { src: url, alt, loading: "lazy", decoding: "async", draggable: "false" });

const validImages = list => (list || []).map(i => ({ ...i, u: safeUrl(i.url) })).filter(i => i.u);

function slider(b) {
  const imgs = validImages(b.images);
  if (!imgs.length) return null;
  const track = h("div", { class: "sl-track", tabindex: "0", role: "region", "aria-label": "Image slider, swipe or use the arrow keys" },
    imgs.map((i, n) => h("figure", { class: "sl-slide", "aria-label": `${n + 1} of ${imgs.length}` },
      img(i.u, i.caption || ""), i.caption ? h("figcaption", {}, i.caption) : null)));
  if (imgs.length === 1) return h("div", { class: "slider" }, track);

  const count = h("span", { class: "sl-count", "aria-live": "polite" }, `1 / ${imgs.length}`);
  const go = d => track.scrollBy({ left: d * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  const prev = h("button", { class: "sl-btn", type: "button", "aria-label": "Previous image", onclick: () => go(-1), disabled: true }, "←");
  const next = h("button", { class: "sl-btn", type: "button", "aria-label": "Next image", onclick: () => go(1) }, "→");
  track.addEventListener("scroll", () => {
    const n = Math.round(track.scrollLeft / track.clientWidth);
    count.textContent = `${n + 1} / ${imgs.length}`;
    prev.disabled = n <= 0;
    next.disabled = n >= imgs.length - 1;
  }, { passive: true });
  track.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  return h("div", { class: "slider" }, track, h("div", { class: "sl-ctrl" }, prev, count, next));
}

function beforeAfter(b) {
  const before = safeUrl(b.before), after = safeUrl(b.after);
  if (!before || !after) return null;
  const wrap = h("div", { class: "ba" });
  const range = h("input", {
    type: "range", min: "0", max: "100", value: "50", step: "0.5", class: "ba-range",
    "aria-label": "Drag to compare before and after",
  });
  const set = v => wrap.style.setProperty("--pos", v + "%");
  range.addEventListener("input", () => set(range.value));
  set(50);
  wrap.append(
    h("img", { src: after, alt: b.afterLabel || "After", class: "ba-img", draggable: "false" }),
    h("img", { src: before, alt: b.beforeLabel || "Before", class: "ba-img ba-before", draggable: "false" }),
    h("div", { class: "ba-line", "aria-hidden": "true" }, h("span", { class: "ba-knob" }, "↔")),
    h("span", { class: "ba-tag l", "aria-hidden": "true" }, b.beforeLabel || "Before"),
    h("span", { class: "ba-tag r", "aria-hidden": "true" }, b.afterLabel || "After"),
    range);
  return figure(wrap, b.caption);
}

function video(b) {
  const u = safeUrl(b.url);
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  let media;
  if (yt || vm) {
    const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : `https://player.vimeo.com/video/${vm[1]}`;
    media = h("div", { class: "b-embed" }, h("iframe", {
      src, title: b.caption || "Video", loading: "lazy", allowfullscreen: true,
      allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen",
    }));
  } else {
    media = h("video", { src: u, class: "b-video", controls: true, playsinline: true, preload: "metadata" });
    if (b.autoplay) { media.muted = true; media.loop = true; media.autoplay = true; media.setAttribute("muted", ""); }
  }
  return figure(media, b.caption);
}

const RENDER = {
  text: b => b.text ? h("div", { class: "prose" }, paragraphs(b.text).map(t => h("p", {}, t))) : null,
  image: b => { const u = safeUrl(b.url); return u ? figure(img(u, b.caption || ""), b.caption) : null; },
  gallery: b => {
    const imgs = validImages(b.images);
    return imgs.length ? h("div", { class: `b-gallery cols-${[1, 2, 3].includes(+b.columns) ? +b.columns : 2}` },
      imgs.map(i => figure(img(i.u, i.caption || ""), i.caption))) : null;
  },
  slider,
  beforeafter: beforeAfter,
  video,
};

function renderBlock(b) {
  const content = RENDER[b?.type]?.(b);
  if (!content) return null;
  const size = ["small", "normal", "full"].includes(b.size) ? b.size : "normal";
  return h("section", { class: `blk blk-${b.type} size-${size} reveal` }, content);
}

// ---------- Halaman ----------
function notFound(title) {
  document.title = title;
  app.replaceChildren(h("div", { class: "detail" },
    h("a", { class: "back", href: "/" }, "← Back to home"),
    h("div", { class: "detail-top" }, h("p", { class: "year" }, "404"), h("h1", {}, title))));
}

function render({ profile, project: p, route: r }) {
  const name = profile.name;
  setupChrome(name);
  renderSidebar(profile, { base: "/" });

  if (!r.slug && !r.id) return notFound("Page not found");
  if (!p) return notFound("Project not found");

  // Ganti alamat lama (?id=…) jadi /project/<slug>
  const pretty = projectUrl(p);
  if (p.slug && location.pathname !== pretty) history.replaceState(null, "", pretty);

  document.title = `${p.title}${name ? " — " + name : ""}`;
  const blocks = (Array.isArray(p.blocks) ? p.blocks : []).map(renderBlock).filter(Boolean);
  const cover = safeUrl(p.image_url);
  // Banyak link (label + url); project lama yang cuma punya "url" tetap tampil.
  const links = (Array.isArray(p.links) && p.links.length ? p.links : p.url ? [{ label: "Open project", url: p.url }] : [])
    .map(l => ({ label: l.label || l.url, u: safeUrl(l.url) }))
    .filter(l => l.u);
  const facts = [
    p.year ? ["Year", p.year] : null,
    p.location ? ["Location", p.location] : null,
    p.tags?.length ? ["Category", p.tags.join(", ")] : null,
    links.length ? [links.length > 1 ? "Links" : "Link",
      h("span", { class: "link-stack" }, links.map(l => h("a", { href: l.u, target: "_blank", rel: "noopener" }, l.label + " ↗")))] : null,
  ].filter(Boolean);
  const desc = paragraphs(p.description);
  const pdf = safeUrl(p.pdf_url);
  if (pdf) facts.push(["Paper", h("a", { href: downloadUrl(pdf) }, "Download PDF ↓")]);

  app.replaceChildren(h("article", { class: "detail" },
    p.kind === "research"
      ? h("a", { class: "back", href: "/#research" }, "← All research")
      : h("a", { class: "back", href: "/#design" }, "← All projects"),
    h("header", { class: "detail-top reveal" },
      (p.year || p.location) ? h("p", { class: "year" }, [p.year, p.location].filter(Boolean).join(" | ")) : null,
      h("h1", {}, p.title),
      p.subtitle ? h("p", { class: "lead" }, p.subtitle) : null),
    // Foto cover tampil di sini hanya kalau project belum punya blok konten.
    !blocks.length && cover ? h("div", { class: "detail-media reveal" }, h("img", { src: cover, alt: p.title })) : null,
    (facts.length || desc.length) ? h("section", { class: "block" },
      h("dl", { class: "facts reveal" }, facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))),
      h("div", { class: "prose reveal" }, desc.map(t => h("p", {}, t)))) : null,
    pdf ? h("div", { class: "blocks" }, pdfViewer(pdf, p.title)) : null,
    blocks.length ? h("div", { class: "blocks" }, blocks) : null));
  reveal();
}

// ---------- Preview PDF paper (research) ----------
// Halaman PDF digambar dengan PDF.js supaya tampil sama di HP & laptop.
// Kalau PDF.js gagal dimuat, pakai penampil PDF bawaan browser.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/";

function downloadUrl(u) {
  return u.includes("/storage/v1/object/public/") ? u + (u.includes("?") ? "&" : "?") + "download=" : u;
}

function pdfViewer(url, title) {
  const info = h("span", { class: "pdf-info" }, "Paper (PDF)");
  const pages = h("div", { class: "pdf-pages", tabindex: "0", "aria-label": "Paper preview, scrollable" },
    h("p", { class: "sub pdf-loading" }, "Loading PDF preview…"));
  renderPdf(url, pages, info).catch(() => {
    pages.replaceChildren(h("iframe", { class: "pdf-frame", src: url, title: `${title} (PDF)` }));
  });
  return h("section", { class: "blk size-normal pdf reveal", id: "paper" },
    h("div", { class: "pdf-bar" }, info,
      h("span", { class: "pdf-actions" },
        h("a", { class: "pill", href: url, target: "_blank", rel: "noopener" }, "Open full screen ↗"),
        h("a", { class: "pill solid", href: downloadUrl(url) }, "Download PDF"))),
    pages);
}

async function renderPdf(url, box, info) {
  const pdfjs = await import(PDFJS + "pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ url }).promise;
  const first = await doc.getPage(1);
  const v = first.getViewport({ scale: 1 });
  box.style.setProperty("--ar", `${v.width} / ${v.height}`);
  info.textContent = `Paper · ${doc.numPages} pages`;
  box.replaceChildren();

  // Halaman digambar saat mendekati area yang terlihat (hemat untuk PDF tebal).
  const draw = async slot => {
    const page = await doc.getPage(+slot.dataset.n);
    const base = page.getViewport({ scale: 1 });
    const scale = ((slot.clientWidth || box.clientWidth) / base.width) * Math.min(devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale });
    const canvas = h("canvas", { width: String(Math.floor(viewport.width)), height: String(Math.floor(viewport.height)) });
    slot.append(canvas);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); }
  }), { root: box, rootMargin: "600px 0px" });
  for (let n = 1; n <= doc.numPages; n++) {
    const slot = h("div", { class: "pdf-page", "data-n": String(n), role: "img", "aria-label": `Page ${n} of ${doc.numPages}` });
    box.append(slot);
    io.observe(slot);
  }
}

load()
  .then(async data => { if (!(await maintenanceGate(await getClient(), data.profile))) render(data); })
  .catch(e => {
  app.replaceChildren(h("p", { class: "sub", style: "padding:96px 0" }, "Failed to load: " + (e.message || e)));
});
