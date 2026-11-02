import Link from "next/link";
export function Privacy({
  nativeAdsEnabled = false,
}: {
  nativeAdsEnabled?: boolean;
}) {
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
          appearance and advertising preferences stay in your browser.
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
          are served by BackInIt. Live match visualizations may load from
          SportScore and its tracker provider when a matching live tracker is
          available. Those providers receive your IP address and browser
          information; their own privacy policies apply. They do not receive
          your BackInIt account credentials. PPV broadcast players load only
          when you select Play. PPV and its embed providers receive your IP
          address, browser information and may show their own advertising. Their
          controls and privacy practices apply. Viewer counts labelled PPV are
          supplied by that provider, not measured BackInIt viewers.
        </p>
        <h2>Advertising</h2>
        {nativeAdsEnabled ? (
          <>
            <p>
              With your cookie permission, we load ads from Adsterra, HilltopAds
              and their advertising partners. They may receive your IP address,
              device and browser information, and use cookies or similar
              technologies to personalize and measure advertising. Formats
              include display and native banners, skippable video sliders,
              Social Bar overlays and Popunder sponsored tabs triggered by
              visitor interaction. We limit loading of the Popunder tag to once
              per 24 hours and Social Bar to once per six hours in this browser.
              The Home video-slider tag is limited to once per 24 hours.
              Creative frequency within the page is controlled by the ad
              networks. We do not send them your BackInIt email, password or
              favourites.
            </p>
            <p>
              Cookie settings at the bottom of the page let you accept
              advertising cookies or use essential cookies only. Changing this
              choice after interactive advertising has loaded reloads the page
              to clear its handlers. It does not erase data already received by
              partners.
            </p>
          </>
        ) : (
          <p>
            Sponsored offers are external advertising links. Selecting one opens
            Adsterra or an advertiser, which may receive your IP address and
            browser information and apply its own cookies and privacy choices.
            We do not automatically load advertising scripts or send advertisers
            your BackInIt email, password or favourites.
          </p>
        )}
        <p>
          See{" "}
          <a
            href="https://adsterra.com/privacy-policy-managed/"
            target="_blank"
            rel="noreferrer"
          >
            Adsterra’s privacy policy
          </a>{" "}
          and{" "}
          <a
            href="https://hilltopads.com/legal#privacypolicy"
            target="_blank"
            rel="noreferrer"
          >
            HilltopAds’ privacy policy
          </a>{" "}
          for their data practices and contact details.
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
