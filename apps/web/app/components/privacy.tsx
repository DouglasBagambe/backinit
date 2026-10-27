import Link from "next/link";
export function Privacy() {
  return (
    <>
      <div className="page-heading">
        <h1>Your data. Your choice.</h1>
      </div>
      <section className="panel privacy-panel">
        <h2>What this installation stores</h2>
        <p>
          Accounts store your email address, password hash, role, hashed
          sessions and recovery codes, favorites and notification preferences.
          Passwords and recovery codes cannot be retrieved as plain text.
          Authentication limits use hashed identifiers and expire after 15
          minutes.
        </p>
        <p>
          Guest favorites, follows and theme preferences stay in your browser.
          The session cookie is needed to keep you signed in. No advertising
          trackers or analytics are included in this build.
        </p>
        <h2>Controls available now</h2>
        <p>
          From <Link href="/profile">your profile</Link> you can export account
          data, change your password, generate recovery codes, sign out every
          session and permanently delete your account. Deletion removes active
          account data immediately. Administrative audit entries are retained
          with the deleted account ID removed; previously created backups remain
          until their operator-managed retention expires.
        </p>
        <p>
          Clearing site data in your browser removes guest preferences and your
          session cookie. It does not delete an account stored on the server.
        </p>
        <h2>External services</h2>
        <p>
          Sports providers receive server-side data requests. Opening a news
          link sends you to the publisher. Video preview images contact
          YouTube’s image servers. Loading a video contacts its source provider;
          embedded video loads only after consent. Providers may receive your IP
          address and apply their own privacy policies. Fonts are served
          locally.
        </p>
        <h2>Before public launch</h2>
        <p>
          This local installation has no published operator contact,
          jurisdiction-specific retention policy or email delivery service.
          Those details must be supplied for a public service. This page
          describes the implemented data controls; it does not claim a completed
          legal or compliance review.
        </p>
      </section>
    </>
  );
}
