import { describe, it, expect } from "vitest";
import { computeHash, type ChainInput } from "./hashChain";

describe("computeHash", () => {
  it("produces a 64-char hex SHA-256 hash", async () => {
    const input: ChainInput = {
      case_id: "test-case-001",
      seq: 1,
      event_type: "session_started",
      payload: { ts: "2026-01-01T00:00:00Z" },
      prev_hash: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    const hash = await computeHash(input);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic output for same input", async () => {
    const input: ChainInput = {
      case_id: "abc",
      seq: 2,
      event_type: "field_captured",
      payload: { field: "merchant", value: "Test" },
      prev_hash: "deadbeef",
      created_at: "2026-04-19T12:00:00Z",
    };
    const hash1 = await computeHash(input);
    const hash2 = await computeHash(input);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const base: ChainInput = {
      case_id: "abc",
      seq: 1,
      event_type: "session_started",
      payload: {},
      prev_hash: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    const hash1 = await computeHash(base);
    const hash2 = await computeHash({ ...base, seq: 2 });
    expect(hash1).not.toBe(hash2);
  });

  it("canonicalizes payload key order", async () => {
    const input1: ChainInput = {
      case_id: "x",
      seq: 1,
      event_type: "test",
      payload: { a: 1, b: 2 },
      prev_hash: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    const input2: ChainInput = {
      ...input1,
      payload: { b: 2, a: 1 }, // different key order, same data
    };
    const hash1 = await computeHash(input1);
    const hash2 = await computeHash(input2);
    expect(hash1).toBe(hash2);
  });

  it("chains correctly — prev_hash changes output", async () => {
    const input: ChainInput = {
      case_id: "chain-test",
      seq: 2,
      event_type: "field_captured",
      payload: { field: "amount_cents", value: 10000 },
      prev_hash: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    const hashWithNull = await computeHash(input);
    const hashWithPrev = await computeHash({ ...input, prev_hash: "abc123" });
    expect(hashWithNull).not.toBe(hashWithPrev);
  });
});
