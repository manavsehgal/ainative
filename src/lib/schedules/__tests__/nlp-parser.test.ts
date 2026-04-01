import { parseNaturalLanguage } from "../nlp-parser";
import { describe, it, expect } from "vitest";

describe("parseNaturalLanguage", () => {
  it("returns null for empty input", () => {
    expect(parseNaturalLanguage("")).toBeNull();
    expect(parseNaturalLanguage("   ")).toBeNull();
  });

  describe("every <day> at <time>", () => {
    it("parses 'every Monday at 9am'", () => {
      const result = parseNaturalLanguage("every Monday at 9am");
      expect(result).toEqual({
        cronExpression: "0 9 * * 1",
        description: "Every Monday at 9 AM",
        confidence: 1.0,
      });
    });

    it("parses 'every Sunday at 8pm'", () => {
      const result = parseNaturalLanguage("every Sunday at 8pm");
      expect(result).toEqual({
        cronExpression: "0 20 * * 0",
        description: "Every Sunday at 8 PM",
        confidence: 1.0,
      });
    });

    it("parses abbreviated day names", () => {
      const result = parseNaturalLanguage("every Wed at 3:30pm");
      expect(result).toEqual({
        cronExpression: "30 15 * * 3",
        description: "Every Wednesday at 3:30 PM",
        confidence: 1.0,
      });
    });

    it("parses 24h time format", () => {
      const result = parseNaturalLanguage("every Fri at 15:00");
      expect(result).toEqual({
        cronExpression: "0 15 * * 5",
        description: "Every Friday at 3 PM",
        confidence: 1.0,
      });
    });
  });

  describe("daily at <time>", () => {
    it("parses 'daily at 3pm'", () => {
      const result = parseNaturalLanguage("daily at 3pm");
      expect(result).toEqual({
        cronExpression: "0 15 * * *",
        description: "Daily at 3 PM",
        confidence: 1.0,
      });
    });

    it("parses 'every day at 15:00'", () => {
      const result = parseNaturalLanguage("every day at 15:00");
      expect(result).toEqual({
        cronExpression: "0 15 * * *",
        description: "Daily at 3 PM",
        confidence: 1.0,
      });
    });

    it("parses 'daily at noon'", () => {
      const result = parseNaturalLanguage("daily at noon");
      expect(result).toEqual({
        cronExpression: "0 12 * * *",
        description: "Daily at 12 PM",
        confidence: 1.0,
      });
    });

    it("parses 'daily at midnight'", () => {
      const result = parseNaturalLanguage("daily at midnight");
      expect(result).toEqual({
        cronExpression: "0 0 * * *",
        description: "Daily at 12 AM",
        confidence: 1.0,
      });
    });
  });

  describe("every N units", () => {
    it("parses 'every 2 hours'", () => {
      const result = parseNaturalLanguage("every 2 hours");
      expect(result).toEqual({
        cronExpression: "0 */2 * * *",
        description: "Every 2 hours",
        confidence: 1.0,
      });
    });

    it("parses 'every 30 minutes'", () => {
      const result = parseNaturalLanguage("every 30 minutes");
      expect(result).toEqual({
        cronExpression: "*/30 * * * *",
        description: "Every 30 minutes",
        confidence: 1.0,
      });
    });

    it("parses 'every 1 hour'", () => {
      const result = parseNaturalLanguage("every 1 hour");
      expect(result).toEqual({
        cronExpression: "0 */1 * * *",
        description: "Every 1 hour",
        confidence: 1.0,
      });
    });
  });

  describe("weekdays at <time>", () => {
    it("parses 'weekdays at noon'", () => {
      const result = parseNaturalLanguage("weekdays at noon");
      expect(result).toEqual({
        cronExpression: "0 12 * * 1-5",
        description: "Weekdays at 12 PM",
        confidence: 1.0,
      });
    });

    it("parses 'every weekday at 9am'", () => {
      const result = parseNaturalLanguage("every weekday at 9am");
      expect(result).toEqual({
        cronExpression: "0 9 * * 1-5",
        description: "Weekdays at 9 AM",
        confidence: 1.0,
      });
    });

    it("parses 'on weekdays at 8:30am'", () => {
      const result = parseNaturalLanguage("on weekdays at 8:30am");
      expect(result).toEqual({
        cronExpression: "30 8 * * 1-5",
        description: "Weekdays at 8:30 AM",
        confidence: 1.0,
      });
    });
  });

  describe("time of day shortcuts", () => {
    it("parses 'every morning'", () => {
      const result = parseNaturalLanguage("every morning");
      expect(result).toEqual({
        cronExpression: "0 9 * * *",
        description: "Every morning at 9 AM",
        confidence: 1.0,
      });
    });

    it("parses 'every evening'", () => {
      const result = parseNaturalLanguage("every evening");
      expect(result).toEqual({
        cronExpression: "0 18 * * *",
        description: "Every evening at 6 PM",
        confidence: 1.0,
      });
    });

    it("parses 'every afternoon'", () => {
      const result = parseNaturalLanguage("every afternoon");
      expect(result).toEqual({
        cronExpression: "0 14 * * *",
        description: "Every afternoon at 2 PM",
        confidence: 1.0,
      });
    });

    it("parses 'every night'", () => {
      const result = parseNaturalLanguage("every night");
      expect(result).toEqual({
        cronExpression: "0 21 * * *",
        description: "Every night at 9 PM",
        confidence: 1.0,
      });
    });
  });

  describe("single-word shortcuts", () => {
    it("parses 'hourly'", () => {
      const result = parseNaturalLanguage("hourly");
      expect(result).toEqual({
        cronExpression: "0 * * * *",
        description: "Every hour",
        confidence: 1.0,
      });
    });

    it("parses 'daily'", () => {
      const result = parseNaturalLanguage("daily");
      expect(result).toEqual({
        cronExpression: "0 9 * * *",
        description: "Daily at 9 AM",
        confidence: 1.0,
      });
    });

    it("parses 'weekly'", () => {
      const result = parseNaturalLanguage("weekly");
      expect(result).toEqual({
        cronExpression: "0 9 * * 1",
        description: "Every Monday at 9 AM",
        confidence: 1.0,
      });
    });

    it("parses 'monthly'", () => {
      const result = parseNaturalLanguage("monthly");
      expect(result).toEqual({
        cronExpression: "0 9 1 * *",
        description: "First of every month at 9 AM",
        confidence: 1.0,
      });
    });
  });

  describe("twice a day", () => {
    it("parses 'twice a day'", () => {
      const result = parseNaturalLanguage("twice a day");
      expect(result).toEqual({
        cronExpression: "0 9,17 * * *",
        description: "Twice a day at 9 AM and 5 PM",
        confidence: 1.0,
      });
    });
  });

  describe("first of every month", () => {
    it("parses 'first of every month'", () => {
      const result = parseNaturalLanguage("first of every month");
      expect(result).toEqual({
        cronExpression: "0 9 1 * *",
        description: "First of every month at 9 AM",
        confidence: 1.0,
      });
    });

    it("parses 'first of every month at 2pm'", () => {
      const result = parseNaturalLanguage("first of every month at 2pm");
      expect(result).toEqual({
        cronExpression: "0 14 1 * *",
        description: "First of every month at 2 PM",
        confidence: 1.0,
      });
    });

    it("parses 'the first of the month'", () => {
      const result = parseNaturalLanguage("the first of the month");
      expect(result).toEqual({
        cronExpression: "0 9 1 * *",
        description: "First of every month at 9 AM",
        confidence: 1.0,
      });
    });
  });

  describe("at <time> (implicit daily)", () => {
    it("parses 'at 9am'", () => {
      const result = parseNaturalLanguage("at 9am");
      expect(result).toEqual({
        cronExpression: "0 9 * * *",
        description: "Daily at 9 AM",
        confidence: 0.9,
      });
    });
  });

  describe("every hour / every minute", () => {
    it("parses 'every hour'", () => {
      const result = parseNaturalLanguage("every hour");
      expect(result).toEqual({
        cronExpression: "0 * * * *",
        description: "Every hour",
        confidence: 1.0,
      });
    });

    it("parses 'every minute'", () => {
      const result = parseNaturalLanguage("every minute");
      expect(result).toEqual({
        cronExpression: "* * * * *",
        description: "Every minute",
        confidence: 1.0,
      });
    });
  });

  describe("on <day> at <time>", () => {
    it("parses 'on Sunday at 8pm'", () => {
      const result = parseNaturalLanguage("on Sunday at 8pm");
      expect(result).toEqual({
        cronExpression: "0 20 * * 0",
        description: "Every Sunday at 8 PM",
        confidence: 1.0,
      });
    });
  });

  describe("case insensitivity", () => {
    it("handles mixed case", () => {
      const result = parseNaturalLanguage("Every MONDAY at 9AM");
      expect(result).not.toBeNull();
      expect(result!.cronExpression).toBe("0 9 * * 1");
    });

    it("handles 'HOURLY'", () => {
      const result = parseNaturalLanguage("HOURLY");
      expect(result).not.toBeNull();
      expect(result!.cronExpression).toBe("0 * * * *");
    });
  });

  describe("unrecognized expressions", () => {
    it("returns null for 'every other Tuesday'", () => {
      expect(parseNaturalLanguage("every other Tuesday")).toBeNull();
    });

    it("returns null for random text", () => {
      expect(parseNaturalLanguage("check the logs please")).toBeNull();
    });

    it("returns null for raw cron expressions", () => {
      // NLP parser should not handle raw cron — that's parseInterval's job
      expect(parseNaturalLanguage("*/5 * * * *")).toBeNull();
    });
  });
});
