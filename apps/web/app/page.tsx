import Link from "next/link";
import Scene from "./scene";
export default function Home() {
  return (
    <main className="landing">
      <div className="hero-copy">
        <span className="eyebrow">COLD CHAIN / DECISION INTELLIGENCE</span>
        <h1>
          Every degree.
          <br />
          Every decision.
          <br />
          <em>In perspective.</em>
        </h1>
        <p>
          Evidence before action. Turn temperature evidence into explainable
          scenarios, compare your options, and bring a clear proposal to QA.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/demo">
            Try interactive demo <span aria-hidden="true">&rarr;</span>
          </Link>
          <a href="#workflow">Explore the workflow</a>
        </div>
        <span className="badge">Synthetic release candidate</span>
      </div>
      <Scene />
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
