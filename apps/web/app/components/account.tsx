"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EventSkeleton } from "./brand";
import { Notifications } from "./notifications";
import { AccountSecurity } from "./account-security";
export type AccountUser = { id: string; email: string; role: "user" | "admin" };
import { accountRequest } from "../lib/account-client";
export { accountRequest } from "../lib/account-client";
export function Account({ onChange }: { onChange: () => void }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    void accountRequest("me")
      .then((r) => setUser(r.user))
      .catch((error) => {
        if (error.status >= 500) setUnavailable(true);
        if (error.status !== 401) setMessage(error.message);
      })
      .finally(() => setChecking(false));
  }, []);
  if (checking)
    return (
      <div className="account-panel">
        <EventSkeleton label="Loading account" />
      </div>
    );
  if (unavailable)
    return (
      <section className="panel account-panel">
        <h2>Accounts are temporarily unavailable</h2>
        <p>
          Please try again later. You can still browse events and watch
          available broadcasts.
        </p>
        <Link className="primary" href="/watch">
          Browse sport
        </Link>
      </section>
    );
  return (
    <section className="panel account-panel">
      {user ? (
        <>
          <h2>Your account</h2>
          <p>Signed in as {user.email}</p>
          <p>Your saved events and preferences stay with your account.</p>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await accountRequest("logout", "POST");
                setUser(null);
                setMode("login");
                onChange();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            Sign out
          </button>
          <Notifications />
          <AccountSecurity
            signedOut={() => {
              setUser(null);
              setMode("login");
              onChange();
              setMessage(
                "Account access updated. Sign in again if your account is still active.",
              );
            }}
          />
        </>
      ) : (
        <>
          <h2>
            {mode === "login"
              ? "Welcome back."
              : mode === "recover"
                ? "Recover your account."
                : "Create an account."}
          </h2>
          <p>Save your favourites and keep them with you across devices.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setMessage("");
              const form = new FormData(e.currentTarget);
              try {
                const r = await accountRequest(mode, "POST", {
                  email: form.get("email"),
                  password: form.get("password"),
                  ...(mode === "recover" ? { code: form.get("code") } : {}),
                });
                if (mode === "recover") {
                  setMode("login");
                  setMessage(
                    "Password reset. All sessions were signed out. Use your new password to sign in.",
                  );
                } else {
                  setUser(r.user);
                  setMode("login");
                  onChange();
                }
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            {mode === "recover" && (
              <label>
                Recovery code
                <input
                  name="code"
                  required
                  autoComplete="off"
                  pattern="[A-Za-z0-9_-]{22}"
                  maxLength={22}
                />
              </label>
            )}
            <label>
              {mode === "recover" ? "New password" : "Password"}
              <input
                type="password"
                name="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                maxLength={128}
              />
            </label>
            <p className="fine">
              Use at least 8 characters. Keep your recovery codes safe; account
              recovery uses these codes, not email. Email addresses are not
              verified.
            </p>
            <button className="primary" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "recover"
                    ? "Reset password"
                    : "Create account"}
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setMessage("");
            }}
          >
            {mode === "login"
              ? "Create an account"
              : "Already registered? Sign in"}
          </button>
          {mode === "login" && (
            <button
              className="text-button"
              onClick={() => {
                setMode("recover");
                setMessage("");
              }}
            >
              Forgot password? Use a recovery code
            </button>
          )}
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
