import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the correct password against its own hash", () => {
    const { hash, salt } = hashPassword("correct horse battery staple");

    const isValid = verifyPassword("correct horse battery staple", hash, salt);

    expect(isValid).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const { hash, salt } = hashPassword("correct horse battery staple");

    const isValid = verifyPassword("wrong password", hash, salt);

    expect(isValid).toBe(false);
  });

  it("generates a different salt for every hash, even for the same password", () => {
    const first = hashPassword("same password");
    const second = hashPassword("same password");

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it("never stores the password itself in the hash or salt", () => {
    const password = "correct horse battery staple";
    const { hash, salt } = hashPassword(password);

    expect(hash).not.toContain(password);
    expect(salt).not.toContain(password);
  });

  it("rejects a malformed stored hash of a different length rather than throwing", () => {
    const { salt } = hashPassword("some password");

    const isValid = verifyPassword("some password", "deadbeef", salt);

    expect(isValid).toBe(false);
  });
});
