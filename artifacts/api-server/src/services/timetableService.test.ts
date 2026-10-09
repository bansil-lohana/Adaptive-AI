import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNextClass } from "./nextClass";

const entry = (
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  id: string,
) => ({ id, dayOfWeek, startTime, endTime });

describe("getNextClass", () => {
  it("returns a later class today", () => {
    const now = new Date("2026-10-07T08:00:00");
    assert.equal(now.getDay(), 3);
    const next = getNextClass(
      [entry(3, "09:00", "10:00", "a"), entry(3, "14:00", "15:00", "b")],
      now,
    );
    assert.equal(next?.id, "a");
  });

  it("skips a class that already ended today", () => {
    const now = new Date("2026-10-07T11:00:00");
    const next = getNextClass(
      [entry(3, "09:00", "10:00", "past"), entry(4, "09:00", "10:00", "tomorrow")],
      now,
    );
    assert.equal(next?.id, "tomorrow");
  });

  it("wraps from weekend to next week", () => {
    const saturday = new Date("2026-10-10T18:00:00");
    assert.equal(saturday.getDay(), 6);
    const next = getNextClass([entry(1, "10:00", "11:00", "monday")], saturday);
    assert.equal(next?.id, "monday");
  });

  it("handles midnight rollover", () => {
    const now = new Date("2026-10-07T23:50:00");
    const next = getNextClass([entry(4, "08:00", "09:00", "thu")], now);
    assert.equal(next?.id, "thu");
  });

  it("returns null when there are no classes", () => {
    assert.equal(getNextClass([], new Date()), null);
  });
});
