"use client";
import { useEffect, useState } from "react";
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
  useEffect(() => {
    void accountRequest("me")
      .then((r) => setUser(r.user))
      .catch((error) => {
        if (error.status !== 401) setMessage(error.message);
      });
  }, []);
  return (
    <section className="panel account-panel">
      {user ? (
        <>
          <h2>Your account.</h2>
          <p>Signed in as {user.email}</p>
          <p>Your favorites are saved to your account on this installation.</p>
          <p className="fine">Account ID: {user.id}</p>
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
          <p>
            Browse freely. Create an account to keep your favorites across
            browsers on this installation.
          </p>
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
                minLength={12}
                maxLength={128}
              />
            </label>
            <p className="fine">
              At least 12 characters. Recovery uses saved recovery codes. Email
              verification and email delivery are not configured.
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
