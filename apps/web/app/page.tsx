import Link from "next/link";
export default function Home() {
  return (
    <main>
      <p>Cold Chain / Decision intelligence</p>
      <h1>Evidence before action.</h1>
      <p>
        Shipments, temperature evidence, reproducible scenarios and independent
        QA review.
      </p>
      <Link href="/workspace">Open workspace</Link>
      <section aria-labelledby="status">
        <h2 id="status">Synthetic release candidate</h2>
        <p>
          Domain QA policy approval remains open. This system does not certify
          food safety or automatically release goods.
        </p>
      </section>
    </main>
  );
}
