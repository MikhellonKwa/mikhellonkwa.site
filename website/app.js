import { getClient, isConfigured, CV_TYPES, h, safeUrl, projectUrl } from "./db.js";
import { setupChrome, hideMissingNav, reveal, initials, paragraphs, renderSidebar, initDrawer, profileLinks } from "./site.js";

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

function work(projects) {
  const norm = t => t.trim().toLowerCase();
  const tags = [...new Set(projects.flatMap(p => (p.tags || []).map(norm)))];
  const cards = projects.map(card);
  const count = h("span", { class: "count" });
  const setCount = n => (count.textContent = `${n} project`);
  setCount(projects.length);

  const buttons = ["all", ...tags].map(t => h("button", {
    type: "button", "data-t": t, "aria-pressed": t === "all" ? "true" : "false",
    onclick: () => {
      buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
      let n = 0;
      cards.forEach((c, i) => {
        const show = t === "all" || (projects[i].tags || []).some(x => norm(x) === t);
        c.hidden = !show;
        if (show) { n++; c.classList.add("in"); }
      });
      setCount(n);
    },
  }, t));

  return h("section", { class: "work", id: "work", "aria-label": "Project" },
    h("div", { class: "toolbar" },
      tags.length ? h("div", { class: "filters", role: "group", "aria-label": "Filter project" }, buttons) : h("span", {}),
      count),
    projects.length
      ? h("div", { class: "grid" }, cards)
      : h("p", { class: "sub" }, "Belum ada project."));
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
}

load().then(render).catch(e => {
  app.replaceChildren(h("p", { class: "sub", style: "padding:96px 0" }, "Gagal memuat data: " + (e.message || e)));
});
