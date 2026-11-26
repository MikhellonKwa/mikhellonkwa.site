// Data contoh: tampil hanya kalau config.js belum diisi.
export const DEMO = {
  demo: true,
  profile: {
    name: "Mikhellon Kwa",
    headline: "Kalimat besar tentang kamu, misalnya: saya membangun produk digital yang sederhana, cepat, dan bermanfaat.",
    location: "Indonesia",
    email: "info@mikhellonkwa.site",
    bio: "Tulis bio kamu dari halaman admin.\n\nSemua teks, project, dan CV di halaman ini bisa diubah tanpa ngoding.",
    skills: ["HTML", "CSS", "JavaScript", "Figma", "Supabase"],
    links: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/mikhellonkwa/" },
      { label: "GitHub", url: "https://github.com/MikhellonKwa" },
      { label: "Instagram", url: "https://www.instagram.com/mikhellonkwa/" },
    ],
    cv_url: "#cv", // contoh saja; nanti diganti PDF yang diupload dari admin
  },
  projects: [
    {
      id: "d1", slug: "rumah-contoh", title: "Rumah Contoh", year: "2026", location: "Jakarta, Indonesia", subtitle: "Contoh halaman project dengan semua jenis blok",
      tags: ["hunian"], description: "Ceritakan masalahnya, peran kamu, prosesnya, dan hasilnya di sini.", url: "",
      image_url: "https://picsum.photos/id/1040/1200/900",
      blocks: [
        { type: "image", url: "https://picsum.photos/id/1040/1600/900", caption: "Foto besar dengan lebar penuh", size: "full" },
        { type: "text", text: "Blok teks untuk bercerita di antara foto.\n\nBisa beberapa paragraf.", size: "small" },
        { type: "gallery", columns: 3, size: "normal", images: [
          { url: "https://picsum.photos/id/1048/900/700", caption: "" },
          { url: "https://picsum.photos/id/1067/900/700", caption: "" },
          { url: "https://picsum.photos/id/1076/900/700", caption: "" },
        ] },
        { type: "slider", size: "normal", images: [
          { url: "https://picsum.photos/id/1031/1400/900", caption: "Slide 1" },
          { url: "https://picsum.photos/id/1033/1400/900", caption: "Slide 2" },
          { url: "https://picsum.photos/id/1029/1400/900", caption: "Slide 3" },
        ] },
        { type: "beforeafter", before: "https://picsum.photos/id/1040/1400/900?grayscale", after: "https://picsum.photos/id/1040/1400/900", beforeLabel: "Before", afterLabel: "After", caption: "Geser untuk membandingkan", size: "normal" },
        { type: "video", url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", caption: "Contoh video", autoplay: false, size: "normal" },
      ],
    },
    { id: "d2", slug: "redesign-aplikasi-kampus", title: "Redesign Aplikasi Kampus", year: "2025", subtitle: "Studi kasus UI/UX", tags: ["design"], description: "Deskripsi lengkap project.", url: "", image_url: "" },
    { id: "d3", slug: "dashboard-data", title: "Dashboard Data", year: "2025", subtitle: "Visualisasi data penjualan", tags: ["web", "data"], description: "Deskripsi lengkap project.", url: "", image_url: "" },
    { id: "d5", slug: "riset-kepadatan-kota", kind: "research", title: "Riset Kepadatan Kota", year: "2025", subtitle: "Contoh research dengan PDF paper", tags: ["urban", "data"], description: "Contoh research.", url: "", image_url: "", pdf_url: "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf" },
    { id: "d6", slug: "studi-hunian-vertikal", kind: "research", title: "Studi Hunian Vertikal", year: "2024", subtitle: "Contoh research kedua", tags: ["hunian"], description: "Contoh research.", url: "", image_url: "" },
    { id: "d4", slug: "landing-page-event", title: "Landing Page Event", year: "2024", subtitle: "Website acara himpunan", tags: ["web", "design"], description: "Deskripsi lengkap project.", url: "", image_url: "" },
  ],
  cv: [
    { type: "pengalaman", title: "Posisi / Peran", org: "Nama Perusahaan", period: "2025 — Sekarang", description: "Apa yang kamu kerjakan dan capai." },
    { type: "pengalaman", title: "Magang", org: "Nama Perusahaan", period: "2024", description: "" },
    { type: "pendidikan", title: "Jurusan", org: "Nama Universitas", period: "2021 — 2025", description: "" },
  ],
};
