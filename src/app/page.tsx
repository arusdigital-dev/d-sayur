import Link from "next/link";

const collections = [
  { number: "01", title: "Sayuran segar", detail: "Dari panen pilihan ke meja Anda.", icon: "✳" },
  { number: "02", title: "Buah pilihan", detail: "Manis alami, dipilih setiap hari.", icon: "◒" },
  { number: "03", title: "Bahan dapur", detail: "Teman masak untuk setiap hari.", icon: "⌁" },
];

export default function Home() {
  return (
    <main>
      <div className="announcement">Belanja lebih dekat dengan alam <span>✳</span> Pilihan segar setiap hari</div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="D-Sayur beranda"><span className="brand-mark">d</span><span>d.sayur<span className="brand-dot">.</span></span></Link>
        <nav className="main-nav" aria-label="Navigasi utama"><Link href="/products">Semua produk</Link><Link href="/categories">Kategori</Link><a href="#cerita">Cerita kami</a></nav>
        <div className="header-actions"><Link className="account-link" href="/login">Masuk</Link><Link className="cart-link" href="/cart"><span aria-hidden="true">♧</span> Keranjang</Link></div>
      </header>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span /> SEGAR, LOKAL, PENUH KEBAIKAN</div><h1>Alam baik,<br />hidup <em>lebih</em> baik.</h1><p>Temukan sayur, buah, dan bahan dapur pilihan yang membawa kebaikan dari kebun ke rumah.</p><Link className="primary-button" href="/products">Jelajahi pilihan <span>↗</span></Link><div className="hero-note"><span className="note-stars">✳ ✳ ✳</span><span>Dipilih dengan hati,<br />dikirim dengan segar.</span></div></div>
        <div className="hero-art" aria-label="Ilustrasi hasil bumi segar" role="img"><div className="sun-disc" /><div className="art-caption">DARI KEBUN<br />UNTUKMU</div><div className="leaf leaf-one">❧</div><div className="leaf leaf-two">❧</div><div className="produce produce-orange" /><div className="produce produce-green" /><div className="produce produce-cream" /><div className="art-ground" /><div className="art-label">PANEN HARI INI <span>✳</span></div></div>
        <div className="hero-index">01 <span /> 03</div>
      </section>
      <section className="promise-strip" aria-label="Keunggulan D-Sayur"><span>✳ &nbsp; Pilihan petani lokal</span><i>·</i><span>✳ &nbsp; Kesegaran terjaga</span><i>·</i><span>✳ &nbsp; Kebaikan setiap hari</span></section>
      <section className="collections" id="cerita"><div className="section-heading"><div><div className="eyebrow"><span /> PILIH YANG BAIK</div><h2>Yang segar, <em>selalu.</em></h2></div><Link href="/products" className="text-link">Lihat semua produk <span>↗</span></Link></div><div className="collection-grid">{collections.map((item) => <Link href="/products" className="collection-card" key={item.number}><div className="collection-top"><span>{item.number} / 03</span><span className="collection-icon">{item.icon}</span></div><div><h3>{item.title}</h3><p>{item.detail}</p></div><span className="card-arrow">↗</span></Link>)}</div></section>
      <footer className="site-footer"><Link className="brand" href="/"><span className="brand-mark">d</span><span>d.sayur<span className="brand-dot">.</span></span></Link><span>Baik dari alam, baik untuk kita.</span><span>© 2026 D-Sayur</span></footer>
    </main>
  );
}
