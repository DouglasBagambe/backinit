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
  password: "Eight!42",
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
      a.authenticate({ ...credentials, password: "Seven!7" }, true),
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

it("rotates one-use recovery codes, resets passwords and revokes every session", async () => {
  const a = make();
  const session = await a.authenticate(credentials, true);
  const codes = (
    await a.recoveryCodes(session.user, { password: credentials.password })
  ).codes;
  expect(codes).toHaveLength(5);
  expect(
    a.db.prepare("SELECT code_hash FROM recovery_codes").get()?.code_hash,
  ).not.toBe(codes[0]);
  const newer = (
    await a.recoveryCodes(session.user, { password: credentials.password })
  ).codes;
  await expect(a.recover({ ...credentials, code: codes[0] })).rejects.toThrow(
    "incorrect",
  );
  const replacement = "Reset!42";
  await a.recover({
    email: credentials.email,
    password: replacement,
    code: newer[0],
  });
  expect(() => a.user(`Bearer ${session.token}`)).toThrow("expired");
  await expect(
    a.recover({
      email: credentials.email,
      password: replacement,
      code: newer[0],
    }),
  ).rejects.toThrow("incorrect");
  await expect(a.authenticate(credentials, false)).rejects.toThrow("incorrect");
  expect(
    (await a.authenticate({ ...credentials, password: replacement }, false))
      .user.id,
  ).toBe(session.user.id);
});
it("changes passwords after reauthentication and limits failed attempts persistently", async () => {
  const a = make();
  const session = await a.authenticate(credentials, true);
  await expect(
    a.changePassword(session.user, {
      currentPassword: "incorrect-password",
      password: "Change42",
    }),
  ).rejects.toThrow("incorrect");
  await a.changePassword(session.user, {
    currentPassword: credentials.password,
    password: "Change42",
  });
  expect(() => a.user(`Bearer ${session.token}`)).toThrow();
  for (let i = 0; i < 8; i++)
    await expect(
      a.authenticate({ ...credentials, password: "incorrect-password" }, false),
    ).rejects.toThrow("incorrect");
  await expect(
    a.authenticate({ ...credentials, password: "incorrect-password" }, false),
  ).rejects.toThrow("Too many attempts");
  expect(
    a.db.prepare("SELECT count(*) AS count FROM auth_limits").get()?.count,
  ).toBeGreaterThan(0);
});
it("upgrades legacy hashes without losing accounts or favorites", async () => {
  const { scryptSync } = await import("node:crypto");
  const a = make();
  const old = await a.authenticate(credentials, true);
  const salt = "abcdabcdabcdabcdabcdabcdabcdabcd";
  a.db
    .prepare("UPDATE users SET password=? WHERE id=?")
    .run(
      `${salt}:${scryptSync(credentials.password, salt, 64).toString("hex")}`,
      old.user.id,
    );
  a.favorite(old.user, { kind: "team", target: "Arsenal" }, false);
  const session = await a.authenticate(credentials, false);
  expect(session.user.id).toBe(old.user.id);
  expect(a.db.prepare("SELECT password FROM users").get()?.password).toMatch(
    /^scrypt\$v1\$/,
  );
  expect(a.list(session.user)).toHaveLength(1);
});
it("exports owned data and deletes accounts with dependent records and anonymized audit", async () => {
  const { Notifications } = await import("../apps/api/src/notifications");
  const a = make();
  const alerts = new Notifications(a);
  const session = await a.authenticate(credentials, true);
  a.favorite(session.user, { kind: "team", target: "Arsenal" }, false);
  await a.recoveryCodes(session.user, { password: credentials.password });
  alerts.preferences(session.user, { enabled: true });
  const exported = a.export(session.user);
  expect(exported.account.email).toBe(credentials.email);
  expect(JSON.stringify(exported)).not.toContain("scrypt$");
  expect(JSON.stringify(exported)).not.toContain(session.token);
  await expect(
    a.removeAccount(session.user, {
      password: "incorrect-password",
      confirmation: "DELETE",
    }),
  ).rejects.toThrow();
  await a.removeAccount(session.user, {
    password: credentials.password,
    confirmation: "DELETE",
  });
  expect(() => a.user(`Bearer ${session.token}`)).toThrow();
  for (const table of [
    "users",
    "favorites",
    "sessions",
    "recovery_codes",
    "notification_preferences",
  ])
    expect(
      a.db.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count,
    ).toBe(0);
  expect(
    JSON.stringify(a.db.prepare("SELECT * FROM audit").all()),
  ).not.toContain(session.user.id);
});
