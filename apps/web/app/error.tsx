"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>We lost this play.</h1>
      <p>Something went wrong loading the page. Please try again.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
