import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header className="top">
        <Link href="/" className="brand"><img src="/icon.svg" alt="" />Chai Pot <span>Try-On</span></Link>
        <Link href="/new" className="btn small secondary">Start a gift pot</Link>
      </header>

      <section className="card hero">
        <div className="hero-grid">
        <div>
        <h1 style={{ fontSize: 32, lineHeight: 1.15 }}>Group gifts that actually suit her.</h1>
        <p className="muted" style={{ fontSize: 16, marginTop: 8, maxWidth: 640 }}>
          Four friends, one birthday, and a group chat full of "would this look good on her?". Chai Pot Try-On reads her skin and
          skin tone with YouCam Skin AI, shows every gift idea on her own photo with YouCam virtual try-on, lets the group vote,
          and pools the money for the winner.
        </p>
        <div className="row wrap" style={{ justifyContent: "flex-start", marginTop: 14 }}>
          <Link href="/g/demo" className="btn" style={{ background: "#fff", color: "var(--chai)" }}>Open the demo pot →</Link>
          <Link href="/new" className="btn secondary" style={{ background: "transparent", color: "#fff", borderColor: "#fff" }}>Start your own</Link>
        </div>
        </div>
        <div className="strip">
          {["/demo/aisha.jpg", "/demo/tryon_lip-brick-masala.jpg", "/demo/tryon_ear-gold-jhumka.jpg", "/demo/tryon_top-emerald-kurta.jpg"].map((src, i) => (
            <figure key={src}><img src={src} alt="" /><figcaption>{["Her selfie", "Makeup VTO", "Earrings VTO", "Clothes VTO"][i]}</figcaption></figure>
          ))}
        </div>
        </div>
      </section>

      <section className="how">
        <div className="card"><div className="step-head"><span className="step">1</span><h3>Skin AI reads her</h3></div>
          <p className="muted">One selfie. YouCam <b>Skin Analysis</b> scores 8 concerns (hydration, under-eyes, pores…) and <b>Skin Tone Analysis</b> returns her skin colour, which we turn into undertone and depth.</p></div>
        <div className="card"><div className="step-head"><span className="step">2</span><h3>Try gifts on her</h3></div>
          <p className="muted">Each friend picks from the shelf. Lipsticks go through <b>Makeup VTO</b>, jhumkas and hoops through <b>Earrings VTO</b>, kurtas and blouses through <b>Clothes VTO</b>. Skincare is matched to her Skin AI scores.</p></div>
        <div className="card"><div className="step-head"><span className="step">3</span><h3>Vote with a match score</h3></div>
          <p className="muted">Every idea carries a 0–100 match score with a plain reason ("warm shade suits her warm undertone"). Friends vote on the try-on pictures; ties go to the better match.</p></div>
        <div className="card"><div className="step-head"><span className="step">4</span><h3>Pool and buy</h3></div>
          <p className="muted">Close the vote and the pot splits the price equally (paisa-exact). Everyone chips in; once it's funded, the order goes out. Payments are demo-only in this build.</p></div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>Why this matters</h2>
        <p className="muted">
          Group gifts for beauty and fashion are guesswork: the wrong shade, a metal that doesn't flatter, skincare for a problem she doesn't have.
          Returns are awkward when four people paid. Chai Pot Try-On puts her actual skin data and her actual face into the group decision,
          before anyone spends a rupee.
        </p>
      </section>

      <footer className="muted small">
        Built for the YouCam API Skin AI &amp; eCommerce VTO Hackathon on top of Chai Pot (group wallet). Products are fictional; the demo face is AI-generated.
        <br />Powered by the YouCam API: Skin Analysis · Skin Tone Analysis · Makeup VTO · Earrings VTO · Clothes VTO.
      </footer>
    </main>
  );
}
