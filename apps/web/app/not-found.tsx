import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">OUT OF PLAY · 404</span>
      <h1>This page has left the field.</h1>
      <p>Find your next match on the home feed.</p>
      <Link className="primary" href="/">
        Back to home
      </Link>
    </main>
  );
}
