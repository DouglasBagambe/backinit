"use client";
import { useState } from "react";
import { accountRequest } from "../lib/account-client";
export function AccountSecurity({ signedOut }: { signedOut: () => void }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(form: HTMLFormElement, action: string) {
    setPending(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await accountRequest(action, "POST", data);
      form.reset();
      if (action === "recovery-codes") {
        setCodes(result.codes);
        setMessage("New codes created. Previous codes no longer work.");
      } else {
        setCodes([]);
        signedOut();
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="account-security"
      aria-label="Account security and privacy"
    >
      <h2>Security & privacy</h2>
      <p>
        Export your account data, manage access and keep a recovery method
        somewhere safe.
      </p>
      <p>
        <a href="/api/account/export" download="backinit-account.json">
          Download my account data ↗
        </a>{" "}
        · <a href="/privacy">Privacy information ↗</a>
      </p>
      <details>
        <summary>Recovery codes</summary>
        <p>
          Each code can reset your password once. Save them in a password
          manager or offline. We cannot show them again. Creating a new set
          replaces the old set.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "recovery-codes");
          }}
        >
          <label>
            Current password for recovery codes
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <button disabled={pending}>Generate recovery codes</button>
        </form>
        {codes.length > 0 && (
          <div className="recovery-codes" role="status">
            <strong>Save these five codes now.</strong>
            <ul>
              {codes.map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ul>
            <button onClick={() => setCodes([])}>Hide recovery codes</button>
          </div>
        )}
      </details>
      <details>
        <summary>Change password</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "password");
          }}
        >
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <p>Changing your password signs out every session.</p>
          <button disabled={pending}>Change password and sign out</button>
        </form>
      </details>
      <button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await accountRequest("logout-all", "POST");
            signedOut();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        Sign out everywhere
      </button>
      <details>
        <summary>Delete account</summary>
        <p>
          This permanently removes your account, favorites, recovery codes and
          active sessions. Source-operation audit entries are retained without
          your account ID. Previous backups expire according to the
          installation's retention policy.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "delete");
          }}
        >
          <label>
            Password to delete account
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Type DELETE to confirm
            <input
              name="confirmation"
              autoComplete="off"
              required
              pattern="DELETE"
            />
          </label>
          <button disabled={pending}>Permanently delete my account</button>
        </form>
      </details>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
