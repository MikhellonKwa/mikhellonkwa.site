import { getClient, isConfigured, CV_TYPES, h, safeUrl, projectUrl } from "./db.js";
import { setupChrome, hideMissingNav, reveal, initials, paragraphs, renderSidebar, initDrawer, cleanHashNav, maintenanceGate } from "./site.js";

const app = document.getElementById("app");
initDrawer();

async function load() {
  const sb = await getClient();
  const [p, pr, cv] = await Promise.all([
    sb.from("profile").select("*").eq("id", 1).maybeSingle(),
    sb.from("projects").select("*").order("sort").order("created_at", { ascending: false }),
    sb.from("cv_items").select("*").order("sort").order("created_at", { ascending: false }),
  ]);
  const err = p.error || pr.error || cv.error;
  if (err) throw err;
  return { profile: p.data || {}, projects: pr.data || [], cv: cv.data || [], demo: !isConfigured };
}

const ext = (url, text, cls) => h("a", { href: url, target: "_blank", rel: "noopener", class: cls }, text);

// "2027 | Jakarta, Indonesia"
const yearPlace = p => [p.year, p.location].filter(Boolean).join(" | ");

// ---------- Kartu project ----------
function card(p) {
  const img = safeUrl(p.image_url);
  return h("a", { class: "card reveal", href: projectUrl(p) },
    h("div", { class: "media" },
      img
        ? h("img", { src: img, alt: "", loading: "lazy", decoding: "async" })
        : h("div", { class: "placeholder", "aria-hidden": "true" }, initials(p.title))),
    safeUrl(p.pdf_url) ? h("span", { class: "badge" }, "PDF") : null,
    h("div", { class: "caption" },
      yearPlace(p) ? h("p", { class: "year" }, yearPlace(p)) : null,
      h("h3", {}, p.title),
      p.subtitle ? h("p", { class: "st" }, p.subtitle) : null));
}

// Dua bagian terpisah: Design dan Research. Masing-masing punya filter sendiri.
const isResearch = p => p.kind === "research";

function projectSection(id, title, list, emptyText) {
  const norm = t => t.trim().toLowerCase();
  const tags = [...new Set(list.flatMap(p => (p.tags || []).map(norm)))];
  const count = h("span", { class: "count" });
  const grid = h("div", { class: "grid" }, list.map(p => {
    const c = card(p);
    c.dataset.tags = (p.tags || []).map(norm).join("|");
    return c;
  }));
  const filters = h("div", { class: "filters", role: "group", "aria-label": `Filter ${title}` },
    (tags.length ? ["all", ...tags] : []).map(t =>
      h("button", { type: "button", "data-t": t, onclick: () => showTag(t) }, t)));

  function showTag(t) {
    filters.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
    let n = 0;
    grid.querySelectorAll(".card").forEach(c => {
      const show = t === "all" || c.dataset.tags.split("|").includes(t);
      c.hidden = !show;
      if (show) { n++; c.classList.add("in"); }
    });
    count.textContent = `${n} project`;
  }
  showTag("all");

  return h("section", { class: "work", id, "aria-labelledby": id + "-title" },
    h("h2", { class: "sec-title reveal", id: id + "-title" }, title, h("sup", {}, String(list.length))),
    h("div", { class: "toolbar" }, filters, count),
    list.length ? grid : h("p", { class: "sub empty-note" }, emptyText));
}

// ---------- Blok about / cv / kontak ----------
const block = (id, title, ...content) =>
  h("section", { class: "block", id }, h("h2", { class: "reveal" }, title), h("div", { class: "reveal" }, content));

function cvBlock(cv, skills) {
  const EN = { pengalaman: "Experience", pendidikan: "Education", organisasi: "Organizations", sertifikat: "Certificates & Awards" };
  const groups = CV_TYPES
    .map(([type, label]) => [EN[type] || label, cv.filter(c => c.type === type)])
    .filter(([, items]) => items.length)
    .map(([label, items]) => h("div", { class: "cv-group" },
      h("h3", {}, label),
      items.map(r => h("div", { class: "cv-row" },
        h("span", { class: "period" }, r.period || ""),
        h("div", {},
          h("p", { class: "t" }, r.title),
          r.org ? h("p", { class: "o" }, r.org) : null,
          r.description ? h("p", { class: "d" }, r.description) : null)))));
  if (skills?.length) {
    groups.push(h("div", { class: "cv-group" }, h("h3", {}, "Skill"),
      h("div", { class: "chips" }, skills.map(s => h("span", { class: "chip" }, s)))));
  }
  return groups.length ? block("cv", "Experience", groups) : null;
}

function contact(p) {
  const links = (p.links || []).map(l => ({ ...l, u: safeUrl(l.url) })).filter(l => l.u);
  if (!p.email && !links.length) return null;
  return block("contact", "Contact",
    h("p", { class: "contact-big" },
      "Hire me pls :) ",
      p.email ? h("a", { href: "mailto:" + p.email }, p.email) : "Reach me through the links below."),
    links.length ? h("div", { class: "contact-links" }, links.map(l => ext(l.u, l.label + " ↗"))) : null);
}

function render({ profile: p, projects, cv, demo }) {
  document.title = p.name || "Portofolio";
  setupChrome(p.name);
  renderSidebar(p);

  app.replaceChildren(...[
    demo ? h("div", { class: "notice" }, "Demo mode: data is only stored in this browser.") : null,
    projectSection("design", "Design", projects.filter(x => !isResearch(x)), "No design projects yet."),
    projects.some(isResearch) ? projectSection("research", "Research", projects.filter(isResearch), "") : null,
    p.bio ? block("about", "About", h("div", { class: "prose" }, paragraphs(p.bio).map(t => h("p", {}, t)))) : null,
    cvBlock(cv, p.skills),
    contact(p),
  ].filter(Boolean));

  hideMissingNav();
  reveal();
  // Menu di halaman ini menggulir ke bagiannya tanpa menambah #… ke alamat.
  cleanHashNav();
}

load()
  .then(async data => { if (!(await maintenanceGate(await getClient(), data.profile))) render(data); })
  .catch(e => {
  app.replaceChildren(h("p", { class: "sub", style: "padding:96px 0" }, "Failed to load: " + (e.message || e)));
});
