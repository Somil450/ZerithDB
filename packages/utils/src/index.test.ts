import { describe, it, expect } from "vitest";
import { bytesToBase64, base64ToBytes } from "./index";

describe("Base64 Utilities", () => {
  it("should encode and decode a small array", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = bytesToBase64(bytes);
    expect(b64).toBe("SGVsbG8=");
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(bytes);
  });

  it("should handle a large array (>100KB) without stack overflow", () => {
    const size = 200 * 1024; // 200KB
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = i % 256;
    }

    // This would throw RangeError with the old spread-based implementation
    const b64 = bytesToBase64(bytes);
    expect(b64.length).toBeGreaterThan(size);

    const decoded = base64ToBytes(b64);
    expect(decoded.length).toBe(size);
    expect(decoded).toEqual(bytes);
  });
});

// ─── sleep ────────────────────────────────────────────────────────────────────

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the given duration", async () => {
    const p = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toBeUndefined();
  });

  it("does not resolve before the duration", async () => {
    let resolved = false;
    sleep(500).then(() => {
      resolved = true;
    });
    vi.advanceTimersByTime(499);
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it("resolves for 0ms", async () => {
    const p = sleep(0);
    vi.advanceTimersByTime(0);
    await expect(p).resolves.toBeUndefined();
  });
});

// ─── backoffDelay ─────────────────────────────────────────────────────────────

describe("backoffDelay", () => {
  it("returns a number", () => {
    expect(typeof backoffDelay(0)).toBe("number");
  });

  it("result is within [base/2, base] for attempt 0 (no jitter ceiling exceeded)", () => {
    for (let i = 0; i < 20; i++) {
      const delay = backoffDelay(0);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });

  it("is capped at the max value", () => {
    for (let i = 0; i < 20; i++) {
      const delay = backoffDelay(100);
      expect(delay).toBeLessThanOrEqual(30_000);
      expect(delay).toBeGreaterThanOrEqual(15_000);
    }
  });

  it("respects a custom base and max", () => {
    for (let i = 0; i < 20; i++) {
      const delay = backoffDelay(0, 200, 400);
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    }
  });

  it("increases (stochastically) as attempt grows", () => {
    const avg = (attempt: number) =>
      Array.from({ length: 50 }, () => backoffDelay(attempt)).reduce((a, b) => a + b, 0) / 50;
    expect(avg(5)).toBeGreaterThan(avg(0));
  });

  it("never returns a negative value", () => {
    for (let i = 0; i < 20; i++) {
      expect(backoffDelay(0)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── withTimeout ──────────────────────────────────────────────────────────────

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the fn result when it completes in time", async () => {
    const p = withTimeout(() => Promise.resolve(42), 1000);
    vi.advanceTimersByTime(0);
    await expect(p).resolves.toBe(42);
  });

  it("rejects with ZerithDBError TIMEOUT_EXCEEDED when fn is too slow", async () => {
    const slow = () => new Promise<never>(() => {});
    const p = withTimeout(slow, 500, "took too long");
    vi.advanceTimersByTime(500);
    let caught: unknown;
    try {
      await p;
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as any).name).toBe("ZerithDBError");
    expect((caught as any).code).toBe("TIMEOUT_EXCEEDED");
    expect((caught as any).message).toBe("took too long");
  });

  it("uses the default timeout message when none is provided", async () => {
    const slow = () => new Promise<never>(() => {});
    const p = withTimeout(slow, 100);
    vi.advanceTimersByTime(100);
    let caught: unknown;
    try {
      await p;
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as any).name).toBe("ZerithDBError");
    expect((caught as any).message).toBe("Operation timed out");
  });

  it("propagates errors thrown by fn itself", async () => {
    const failing = () => Promise.reject(new Error("fn failed"));
    const p = withTimeout(failing, 1000);
    vi.advanceTimersByTime(0);
    await expect(p).rejects.toThrow("fn failed");
  });
});

// ─── randomId ─────────────────────────────────────────────────────────────────

describe("randomId", () => {
  it("returns a string", () => {
    expect(typeof randomId()).toBe("string");
  });

  it("matches the UUID v4 format", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(randomId()).toMatch(uuidRegex);
  });

  it("generates unique values on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomId()));
    expect(ids.size).toBe(100);
  });
});
