import { describe, it, expect } from "vitest";
import { redact, redactObject } from "./redact";

describe("redact", () => {
  it("masks credit card numbers", () => {
    const input = "Card number is 4111 1111 1111 1234";
    const result = redact(input);
    expect(result).toContain("****-****-****-1234");
    expect(result).not.toContain("4111");
  });

  it("masks phone numbers", () => {
    const input = "Call me at 415-555-0142";
    const result = redact(input);
    expect(result).toContain("***-***-0142");
    expect(result).not.toContain("415-555");
  });

  it("handles empty/null input", () => {
    expect(redact("")).toBe("");
    expect(redact(null as unknown as string)).toBe(null);
  });

  it("leaves non-PII text unchanged", () => {
    const input = "I want to dispute a charge from Lumen Goods";
    expect(redact(input)).toBe(input);
  });
});

describe("redactObject", () => {
  it("recursively redacts string values in objects", () => {
    const obj = {
      name: "Jane",
      contact: "415-555-0142",
    };
    const result = redactObject(obj);
    expect(result.contact).toContain("***-***-0142");
    expect(result.name).toBe("Jane"); // no PII pattern
  });

  it("handles arrays", () => {
    const arr = ["415-555-0142", "no-pii"];
    const result = redactObject(arr);
    expect(result[0]).toContain("***-***-0142");
    expect(result[1]).toBe("no-pii");
  });

  it("passes through non-string primitives", () => {
    expect(redactObject(42)).toBe(42);
    expect(redactObject(null)).toBe(null);
    expect(redactObject(true)).toBe(true);
  });
});
