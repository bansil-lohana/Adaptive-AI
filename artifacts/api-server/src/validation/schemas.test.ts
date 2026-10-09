import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClock, parseDayName, timetableBodySchema } from "./schemas";

describe("timetable validation helpers", () => {
  it("parses weekday names", () => {
    assert.equal(parseDayName("Monday"), 1);
    assert.equal(parseDayName("wed"), 3);
    assert.equal(parseDayName("not-a-day"), null);
  });

  it("parses 12-hour and 24-hour clocks", () => {
    assert.equal(parseClock("9:00 AM"), "09:00");
    assert.equal(parseClock("12:30 PM"), "12:30");
    assert.equal(parseClock("14:05"), "14:05");
    assert.equal(parseClock("nope"), null);
  });

  it("rejects inverted class times", () => {
    const parsed = timetableBodySchema.safeParse({
      subject: "SE",
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "09:00",
    });
    assert.equal(parsed.success, true);
  });
});
