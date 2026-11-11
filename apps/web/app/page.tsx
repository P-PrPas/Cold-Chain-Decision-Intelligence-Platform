import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <div className="hero-copy">
        <span className="eyebrow">COLD CHAIN / DECISION INTELLIGENCE</span>
        <h1>
          Cold-chain decisions,
          <br />
          <em>grounded in evidence.</em>
        </h1>
        <p>
          For logistics teams and independent QA reviewers. Turn temperature
          evidence into explainable scenarios, compare your options, and bring a
          clear proposal to QA.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/studio">
            Try interactive demo <span aria-hidden="true">&rarr;</span>
          </Link>
          <a href="#workflow">Explore the workflow</a>
        </div>
        <span className="badge">Synthetic release candidate</span>
      </div>
      <section className="product-preview">
        <span className="badge">Illustrative product preview</span>
        <h2>Evidence at a glance</h2>
        <dl className="evidence-grid">
          <div>
            <dt>Shipment</dt>
            <dd>DEMO-003 / Fresh produce</dd>
          </div>
          <div>
            <dt>Data completeness</dt>
            <dd>6 of 9 readings available</dd>
          </div>
          <div>
            <dt>Missing interval</dt>
            <dd>09:30 - 10:30 UTC</dd>
          </div>
          <div>
            <dt>Policy evaluation</dt>
            <dd>Not performed</dd>
          </div>
        </dl>
        <p className="notice">
          Next action: reconcile missing readings before making a proposal.
        </p>
        <Link href="/studio?shipment=DEMO-003">Inspect this example</Link>
      </section>
      <section id="workflow" className="workflow-cards">
        {[
          [
            "01",
            "Understand the journey",
            "Import temperature evidence and inspect the quality of your data.",
          ],
          [
            "02",
            "Explore the alternatives",
            "Compare delivery, inspection, rerouting and isolation scenarios.",
          ],
          [
            "03",
            "Decide with evidence",
            "Submit a reproducible proposal for independent QA review.",
          ],
        ].map(([n, t, d]) => (
          <article key={n}>
            <span className="eyebrow">{n} / WORKFLOW</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <p className="notice">
        Domain QA policy approval remains open. This system does not certify
        food safety or automatically release goods.
      </p>
    </main>
  );
}
