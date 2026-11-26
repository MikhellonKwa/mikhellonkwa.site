import { getClient, h, safeUrl } from "./db.js";
import { setupChrome, reveal, paragraphs, renderSidebar, initDrawer } from "./site.js";

const app = document.getElementById("app");
const id = new URLSearchParams(location.search).get("id");
initDrawer();

async function load() {
  const sb = await getClient();
  const [prof, proj] = await Promise.all([
    sb.from("profile").select("*").eq("id", 1).maybeSingle(),
    id ? sb.from("projects").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // id yang salah format juga dianggap "tidak ditemukan"
  return { profile: prof.data || {}, project: proj.error ? null : proj.data };
}

function render({ profile, project: p }) {
  const name = profile.name;
  setupChrome(name);
  renderSidebar(profile, { base: "./" });
  const back = h("a", { class: "back", href: "./#work" }, "← Semua project");

  if (!p) {
    document.title = "Project tidak ditemukan";
    app.replaceChildren(h("div", { class: "detail" }, back,
      h("div", { class: "detail-top" }, h("h1", {}, "Project tidak ditemukan"))));
    return;
  }

  document.title = `${p.title}${name ? " — " + name : ""}`;
  const img = safeUrl(p.image_url);
  const url = safeUrl(p.url);
  const facts = [
    p.year ? ["Tahun", p.year] : null,
    p.tags?.length ? ["Tag", p.tags.join(", ")] : null,
    url ? ["Link", h("a", { href: url, target: "_blank", rel: "noopener" }, "Buka project ↗")] : null,
  ].filter(Boolean);
  const desc = paragraphs(p.description);

  app.replaceChildren(h("article", { class: "detail" },
    back,
    h("header", { class: "detail-top reveal" },
      p.year ? h("p", { class: "year" }, p.year) : null,
      h("h1", {}, p.title),
      p.subtitle ? h("p", { class: "lead" }, p.subtitle) : null),
    img ? h("div", { class: "detail-media reveal" }, h("img", { src: img, alt: p.title })) : null,
    (facts.length || desc.length) ? h("section", { class: "block", style: img ? "" : "border-top:1px solid var(--line)" },
      h("dl", { class: "facts reveal" }, facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))),
      h("div", { class: "prose reveal" }, desc.map(t => h("p", {}, t)))) : null));
  reveal();
}

load().then(render).catch(e => {
  app.replaceChildren(h("p", { class: "sub", style: "padding:96px 0" }, "Gagal memuat data: " + (e.message || e)));
});
