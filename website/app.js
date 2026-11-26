import { getClient, isConfigured, CV_TYPES, h, safeUrl, projectUrl } from "./db.js";
import { setupChrome, hideMissingNav, reveal, initials, paragraphs, renderSidebar, initDrawer, profileLinks, cleanHashNav } from "./site.js";

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

// ---------- Intro: kalimat besar + tombol link ----------
function intro(p) {
  // Tombol pil ini cuma tampil di HP (di desktop sudah ada di sidebar).
  const pills = profileLinks(p).map(l => l.url.startsWith("mailto:")
    ? h("a", { class: "pill", href: l.url }, l.label)
    : ext(l.url, l.label, l.icon === "cv" ? "pill solid" : "pill"));

  return h("section", { class: "intro" },
    h("h1", { class: "reveal" }, p.headline || p.name || ""),
    p.location ? h("p", { class: "meta reveal" }, p.location) : null,
    pills.length ? h("div", { class: "pills reveal" }, pills) : null);
}

// ---------- Work: filter + grid kartu ----------
function card(p) {
  const img = safeUrl(p.image_url);
  return h("a", { class: "card reveal", href: projectUrl(p) },
    h("div", { class: "media" },
      img
        ? h("img", { src: img, alt: "", loading: "lazy", decoding: "async" })
        : h("div", { class: "placeholder", "aria-hidden": "true" }, initials(p.title))),
    h("div", { class: "caption" },
      p.year ? h("p", { class: "year" }, p.year) : null,
      h("h3", {}, p.title),
      p.subtitle ? h("p", { class: "st" }, p.subtitle) : null));
}

// Tab Work | Research, lalu filter kategori, lalu grid kartu.
const KINDS = [["work", "Work"], ["research", "Research"]];
let selectKind = () => {};
const kindOf = p => (p.kind === "research" ? "research" : "work");

function work(projects) {
  const norm = t => t.trim().toLowerCase();
  const byKind = Object.fromEntries(KINDS.map(([k]) => [k, projects.filter(p => kindOf(p) === k)]));
  const kinds = KINDS.filter(([k]) => byKind[k].length);
  const filters = h("div", { class: "filters", role: "group", "aria-label": "Filter kategori" });
  const count = h("span", { class: "count" });
  const grid = h("div", { class: "grid", role: "tabpanel" });
  let kind = location.hash === "#research" && byKind.research.length ? "research" : (kinds[0]?.[0] || "work");

  const tabs = h("div", { class: "kind-tabs", role: "tablist", "aria-label": "Jenis project" },
    kinds.map(([k, label]) => h("button", {
      type: "button", role: "tab", class: "kind-tab", "data-k": k,
      onclick: () => { if (kind !== k) select(k); },
    }, label, h("sup", {}, String(byKind[k].length)))));

  function showTag(t) {
    filters.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
    let n = 0;
    grid.querySelectorAll(".card").forEach(c => {
      const show = t === "all" || c.dataset.tags.split("|").includes(t);
      c.hidden = !show;
      if (show) n++;
    });
    count.textContent = `${n} project`;
  }

  function select(k) {
    kind = k;
    tabs.querySelectorAll(".kind-tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.k === k)));
    const list = byKind[k];
    const tags = [...new Set(list.flatMap(p => (p.tags || []).map(norm)))];
    filters.replaceChildren(...(tags.length ? ["all", ...tags] : []).map(t =>
      h("button", { type: "button", "data-t": t, onclick: () => showTag(t) }, t)));
    grid.replaceChildren(...list.map(p => {
      const c = card(p);
      c.classList.add("in");
      c.dataset.tags = (p.tags || []).map(norm).join("|");
      return c;
    }));
    showTag("all");
  }

  // Menu sidebar "Work" / "Research" ikut mengganti tab.
  selectKind = k => { if (byKind[k]?.length && k !== kind) select(k); };

  if (!projects.length) {
    return h("section", { class: "work", id: "work", "aria-label": "Project" },
      h("div", { class: "toolbar" }, h("span", {}), h("span", { class: "count" }, "0 project")),
      h("p", { class: "sub" }, "Belum ada project."));
  }
  select(kind);
  return h("section", { class: "work", id: "work", "aria-label": "Project" },
    byKind.research.length ? h("span", { id: "research", class: "anchor" }) : null,
    tabs,
    h("div", { class: "toolbar" }, filters, count),
    grid);
}

// ---------- Blok about / cv / kontak ----------
const block = (id, title, ...content) =>
  h("section", { class: "block", id }, h("h2", { class: "reveal" }, title), h("div", { class: "reveal" }, content));

function cvBlock(cv, skills) {
  const groups = CV_TYPES
    .map(([type, label]) => [label, cv.filter(c => c.type === type)])
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
      "Tertarik kerja bareng atau sekadar ngobrol? ",
      p.email ? h("a", { href: "mailto:" + p.email }, p.email) : "Hubungi saya lewat link di bawah."),
    links.length ? h("div", { class: "contact-links" }, links.map(l => ext(l.u, l.label + " ↗"))) : null);
}

function render({ profile: p, projects, cv, demo }) {
  document.title = p.name || "Portofolio";
  setupChrome(p.name);
  renderSidebar(p);

  app.replaceChildren(...[
    demo ? h("div", { class: "notice" }, "Mode demo: data masih tersimpan di browser ini saja. Sambungkan Supabase supaya bisa online (lihat PANDUAN.md).") : null,
    intro(p),
    work(projects),
    p.bio ? block("about", "About", h("div", { class: "prose" }, paragraphs(p.bio).map(t => h("p", {}, t)))) : null,
    cvBlock(cv, p.skills),
    contact(p),
  ].filter(Boolean));

  hideMissingNav();
  reveal();
  // Menu di halaman ini menggulir ke bagiannya tanpa menambah #… ke alamat.
  cleanHashNav(id => selectKind(id));
}

load().then(render).catch(e => {
  app.replaceChildren(h("p", { class: "sub", style: "padding:96px 0" }, "Gagal memuat data: " + (e.message || e)));
});
