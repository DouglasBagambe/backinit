import { afterEach, describe, it, expect } from "vitest";
import { Accounts } from "../apps/api/src/accounts";
const stores: Accounts[] = [];
const make = () => {
  const a = new Accounts(":memory:");
  stores.push(a);
  return a;
};
afterEach(() => stores.splice(0).forEach((a) => a.db.close()));
const credentials = {
  email: "fan@example.test",
  password: "correct-horse-battery-staple",
};
describe("durable accounts and authorization", () => {
  it("stores salted password hashes and hashed, expiring sessions; logout revokes access", async () => {
    const a = make();
    const session = await a.authenticate(credentials, true);
    expect(a.user(`Bearer ${session.token}`).email).toBe(credentials.email);
    expect(
      (a.db.prepare("SELECT password FROM users").get() as { password: string })
        .password,
    ).not.toContain(credentials.password);
    expect(
      (
        a.db.prepare("SELECT token_hash FROM sessions").get() as {
          token_hash: string;
        }
      ).token_hash,
    ).not.toBe(session.token);
    a.logout(`Bearer ${session.token}`);
    expect(() => a.user(`Bearer ${session.token}`)).toThrow("expired");
  });
  it("rejects wrong credentials, duplicate accounts, weak passwords and self-assigned roles", async () => {
    const a = make();
    await a.authenticate(credentials, true);
    await expect(
      a.authenticate({ ...credentials, password: "incorrect-password" }, false),
    ).rejects.toThrow("incorrect");
    await expect(a.authenticate(credentials, true)).rejects.toThrow(
      "Unable to create",
    );
    await expect(
      a.authenticate({ ...credentials, role: "admin" }, true),
    ).rejects.toThrow("valid email");
    await expect(
      a.authenticate({ ...credentials, password: "short" }, true),
    ).rejects.toThrow();
  });
  it("isolates favorites between users and denies privileged access by default", async () => {
    const a = make();
    const first = await a.authenticate(credentials, true);
    const second = await a.authenticate(
      { ...credentials, email: "other@example.test" },
      true,
    );
    a.favorite(first.user, { kind: "team", target: "Arsenal" }, false);
    expect(a.list(first.user)).toEqual([{ kind: "team", target: "Arsenal" }]);
    expect(a.list(second.user)).toEqual([]);
    expect(() => a.admin(`Bearer ${first.token}`)).toThrow("Administrator");
    expect(() => a.admin()).toThrow("Sign in");
    a.favorite(first.user, { kind: "team", target: "Arsenal" }, true);
    expect(a.list(first.user)).toEqual([]);
  });
});
