"use client";
import { useEffect, useState } from "react";
export type AccountUser = { id: string; email: string; role: "user" | "admin" };
export async function accountRequest(
  action: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`/api/account/${action}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({
    message: "Account request failed. Please reload and retry.",
  }));
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof result.message === "string"
          ? result.message
          : "Unable to complete request.",
      ),
      { status: response.status },
    );
  return result;
}
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
          <h2>You’re back in it.</h2>
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
        </>
      ) : (
        <>
          <h2>{mode === "login" ? "Welcome back." : "Make sport yours."}</h2>
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
                });
                setUser(r.user);
                onChange();
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
            <label>
              Password
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
              At least 12 characters. Email verification and password recovery
              are not yet available.
            </p>
            <button className="primary" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
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
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
