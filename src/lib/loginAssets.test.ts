import { expect, test } from "bun:test";
import { clearRememberedAccount, readRememberedAccount, writeRememberedAccount } from "./loginAssets";

test("remembered login migration retains the account and removes all legacy secrets", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  try {
    const key = "gpt-image-login-remember";
    values.set(key, JSON.stringify({ account: "test-account", password: crypto.randomUUID() }));
    expect(readRememberedAccount()).toBe("test-account");
    expect(JSON.parse(values.get(key)!)).toEqual({ account: "test-account" });
    writeRememberedAccount("another-account");
    expect(JSON.parse(values.get(key)!)).toEqual({ account: "another-account" });
    clearRememberedAccount();
    expect(readRememberedAccount()).toBe("");
    values.set(key, "invalid JSON");
    expect(readRememberedAccount()).toBe("");
    expect(values.has(key)).toBe(false);
    values.set(key, JSON.stringify({ account: "test-account", password: crypto.randomUUID() }));
    storage.setItem = () => { throw new Error("storage unavailable"); };
    expect(readRememberedAccount()).toBe("");
    expect(values.has(key)).toBe(false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
