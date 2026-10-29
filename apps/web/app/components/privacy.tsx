import Link from "next/link";
export function Privacy() {
  return (
    <>
      <div className="page-heading">
        <h1>Privacy</h1>
      </div>
      <section className="panel privacy-panel">
        <h2>Information we keep</h2>
        <p>
          When you create an account, we store your email address, your
          favourites, notification preferences and the information needed to
          keep your account secure. Passwords and recovery codes are stored in a
          protected form and cannot be shown to you again. We limit repeated
          sign-in attempts to help protect accounts.
        </p>
        <p>
          Your session cookie keeps you signed in. Guest favourites, follows and
          appearance settings stay in your browser. BackInIt does not currently
          run its own advertising trackers or analytics.
        </p>
        <h2>Your controls</h2>
        <p>
          In <Link href="/profile">your account</Link>, you can download your
          data, change your password, generate recovery codes, sign out
          everywhere or delete your account.
        </p>
        <p>
          Deleting your account removes its active account data and signs out
          your sessions. Administrative audit records are retained with your
          account ID removed. Backup copies expire under our hosting provider’s
          retention policy.
        </p>
        <p>
          Clearing your browser’s site data removes guest preferences and your
          session cookie. It does not delete your account.
        </p>
        <h2>Other providers</h2>
        <p>
          Team badges and video thumbnails may load from external image servers.
          Embedded players load after your consent. Loading a video contacts its
          publisher. These services may receive your IP address and apply their
          own privacy policies. News links open the publisher’s website. Fonts
          are served by BackInIt.
        </p>
        <h2>Contact us</h2>
        <p>
          For privacy, account or data questions, email{" "}
          <a href="mailto:support@backinit.live">support@backinit.live</a>.
        </p>
      </section>
    </>
  );
}
