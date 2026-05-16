import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { DbClient } from "../../packages/db/src/db-client.js";
import type { ZerithDBConfig } from "../../packages/core/src/index.js";

const testConfig: ZerithDBConfig = {
  appId: "test-operators-" + Math.random().toString(36).slice(2),
};

describe("DbClient — Operators ($exists, $regex)", () => {
  let db: DbClient;

  beforeEach(() => {
    const uniqueConfig = {
      appId: "test-ops-" + Math.random().toString(36).slice(2),
    };
    db = new DbClient(uniqueConfig);
  });

  afterEach(async () => {
    await db.dispose();
  });

  describe("$exists", () => {
    it("should match documents where the field is present", async () => {
      const col = db.collection<{ name: string; age?: number }>("users");
      await col.insert({ name: "Alice", age: 30 });
      await col.insert({ name: "Bob" });

      const withAge = await col.find({ age: { $exists: true } });
      expect(withAge).toHaveLength(1);
      expect(withAge[0]?.name).toBe("Alice");
    });

    it("should match documents where the field is NOT present", async () => {
      const col = db.collection<{ name: string; age?: number }>("users");
      await col.insert({ name: "Alice", age: 30 });
      await col.insert({ name: "Bob" });

      const withoutAge = await col.find({ age: { $exists: false } });
      expect(withoutAge).toHaveLength(1);
      expect(withoutAge[0]?.name).toBe("Bob");
    });
  });

  describe("$regex", () => {
    it("should match documents with string regex", async () => {
      const col = db.collection<{ name: string }>("users");
      await col.insert({ name: "ZerithDB" });
      await col.insert({ name: "MongoDB" });
      await col.insert({ name: "PostgreSQL" });

      const matches = await col.find({ name: { $regex: "Zerith" } });
      expect(matches).toHaveLength(1);
      expect(matches[0]?.name).toBe("ZerithDB");
    });

    it("should match documents with case-insensitive regex", async () => {
      const col = db.collection<{ name: string }>("users");
      await col.insert({ name: "ZerithDB" });
      await col.insert({ name: "zerith" });

      const matches = await col.find({ name: { $regex: "zerith" } });
      // Default regex in JS is case-sensitive if passed as string without flags in constructor
      // but if we use new RegExp(pattern), it's case sensitive by default.
      expect(matches).toHaveLength(1);
      expect(matches[0]?.name).toBe("zerith");

      const matchesInsensitive = await col.find({ name: { $regex: /zerith/i } });
      expect(matchesInsensitive).toHaveLength(2);
    });

    it("should match documents starting with a pattern", async () => {
      const col = db.collection<{ name: string }>("users");
      await col.insert({ name: "ZerithDB" });
      await col.insert({ name: "The Zerith" });

      const matches = await col.find({ name: { $regex: "^Zerith" } });
      expect(matches).toHaveLength(1);
      expect(matches[0]?.name).toBe("ZerithDB");
    });

    it("should support direct RegExp objects", async () => {
      const col = db.collection<{ name: string }>("users");
      await col.insert({ name: "ZerithDB" });
      await col.insert({ name: "MongoDB" });

      const matches = await col.find({ name: /zerith/i });
      expect(matches).toHaveLength(1);
      expect(matches[0]?.name).toBe("ZerithDB");
    });

    it("should NOT match non-string values with $regex", async () => {
      const col = db.collection<{ age: number }>("users");
      await col.insert({ age: 30 } as any);

      // Even if the string representation matches, $regex should only match strings
      const matches = await col.find({ age: { $regex: "30" } } as any);
      expect(matches).toHaveLength(0);
    });
  });
});
