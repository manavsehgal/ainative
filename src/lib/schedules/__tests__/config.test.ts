import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getScheduleMaxConcurrent,
  getScheduleMaxRunDurationSec,
  getScheduleChatPressureDelaySec,
} from "../config";

describe("schedule config", () => {
  beforeEach(() => {
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxRunDurationSec")).run();
    db.delete(settings).where(eq(settings.key, "schedule.chatPressureDelaySec")).run();
  });

  it("returns default max concurrent of 2 when setting is absent", () => {
    expect(getScheduleMaxConcurrent()).toBe(2);
  });

  it("reads max concurrent from settings when set", () => {
    db.insert(settings)
      .values({
        key: "schedule.maxConcurrent",
        value: "3",
        updatedAt: new Date(),
      })
      .run();
    expect(getScheduleMaxConcurrent()).toBe(3);
  });

  it("reads max concurrent from SCHEDULE_MAX_CONCURRENT env var", () => {
    const original = process.env.SCHEDULE_MAX_CONCURRENT;
    process.env.SCHEDULE_MAX_CONCURRENT = "5";
    try {
      expect(getScheduleMaxConcurrent()).toBe(5);
    } finally {
      if (original === undefined) delete process.env.SCHEDULE_MAX_CONCURRENT;
      else process.env.SCHEDULE_MAX_CONCURRENT = original;
    }
  });

  it("falls back to default when env var is NaN", () => {
    const original = process.env.SCHEDULE_MAX_CONCURRENT;
    process.env.SCHEDULE_MAX_CONCURRENT = "abc";
    try {
      expect(getScheduleMaxConcurrent()).toBe(2);
    } finally {
      if (original === undefined) delete process.env.SCHEDULE_MAX_CONCURRENT;
      else process.env.SCHEDULE_MAX_CONCURRENT = original;
    }
  });

  it("returns default max run duration of 1200s", () => {
    expect(getScheduleMaxRunDurationSec()).toBe(1200);
  });

  it("returns default chat pressure delay of 30s", () => {
    expect(getScheduleChatPressureDelaySec()).toBe(30);
  });
});
