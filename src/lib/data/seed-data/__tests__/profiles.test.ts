import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentProfile } from "@/lib/agents/profiles/types";

const {
  createProfile,
  updateProfile,
  deleteProfile,
  getProfile,
  isBuiltin,
} = vi.hoisted(() => ({
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
  getProfile: vi.fn(),
  isBuiltin: vi.fn(),
}));

vi.mock("@/lib/agents/profiles/registry", () => ({
  createProfile,
  updateProfile,
  deleteProfile,
  getProfile,
  isBuiltin,
}));

import {
  SAMPLE_PROFILE_IDS,
  clearSampleProfiles,
  getSampleProfiles,
  upsertSampleProfiles,
} from "../profiles";
import { createSchedules } from "../schedules";

describe("sample profile seeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfile.mockReturnValue(undefined);
    isBuiltin.mockReturnValue(false);
  });

  it("defines stable reserved sample profile ids", () => {
    expect(SAMPLE_PROFILE_IDS).toHaveLength(5);
    expect(SAMPLE_PROFILE_IDS.every((id) => id.startsWith("stagent-sample-"))).toBe(true);
  });

  it("returns realistic sample profiles with skill markdown", () => {
    const profiles = getSampleProfiles();

    expect(profiles).toHaveLength(5);
    expect(profiles.map((profile) => profile.config.id)).toEqual(
      Array.from(SAMPLE_PROFILE_IDS)
    );
    expect(profiles[0].skillMd).toContain("description:");
    expect(profiles[1].config.tags).toContain("SEO");
    expect(profiles[4].config.domain).toBe("work");
  });

  it("creates missing sample profiles", () => {
    const count = upsertSampleProfiles();

    expect(count).toBe(5);
    expect(createProfile).toHaveBeenCalledTimes(5);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("updates existing custom sample profiles", () => {
    const existingProfile = { id: SAMPLE_PROFILE_IDS[0] } as AgentProfile;
    getProfile.mockImplementation((id: string) =>
      id === SAMPLE_PROFILE_IDS[0] ? existingProfile : undefined
    );

    const count = upsertSampleProfiles();

    expect(count).toBe(5);
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith(
      SAMPLE_PROFILE_IDS[0],
      expect.objectContaining({ id: SAMPLE_PROFILE_IDS[0] }),
      expect.stringContaining("GTM Launch Strategist")
    );
    expect(createProfile).toHaveBeenCalledTimes(4);
  });

  it("throws if a sample id collides with a built-in profile", () => {
    getProfile.mockReturnValue({ id: SAMPLE_PROFILE_IDS[0] } as AgentProfile);
    isBuiltin.mockImplementation((id: string) => id === SAMPLE_PROFILE_IDS[0]);

    expect(() => upsertSampleProfiles()).toThrow(/collides with a built-in profile/);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(createProfile).not.toHaveBeenCalled();
  });

  it("deletes only existing non-builtin sample profiles", () => {
    getProfile.mockImplementation((id: string) =>
      id === SAMPLE_PROFILE_IDS[0] || id === SAMPLE_PROFILE_IDS[4]
        ? ({ id } as AgentProfile)
        : undefined
    );
    isBuiltin.mockImplementation((id: string) => id === SAMPLE_PROFILE_IDS[4]);

    const deleted = clearSampleProfiles();

    expect(deleted).toBe(1);
    expect(deleteProfile).toHaveBeenCalledTimes(1);
    expect(deleteProfile).toHaveBeenCalledWith(SAMPLE_PROFILE_IDS[0]);
  });
});

describe("schedule seeds", () => {
  it("creates schedules tied to seeded projects and profile surfaces", () => {
    const projectIds = [
      "project-launch",
      "project-content",
      "project-cs",
      "project-tvp",
      "project-greenleaf",
      "project-medreach",
      "project-revops",
      "project-compliance",
    ];

    const schedules = createSchedules(projectIds);

    expect(schedules).toHaveLength(8);
    // Each project gets one schedule
    expect(schedules.map((schedule) => schedule.projectId)).toEqual(projectIds);
    // Active schedules have a nextFireAt
    expect(
      schedules.filter((schedule) => schedule.status === "active").every(
        (schedule) => schedule.nextFireAt instanceof Date
      )
    ).toBe(true);
    // Non-active schedules have null nextFireAt
    expect(
      schedules.filter((schedule) => schedule.status !== "active").every(
        (schedule) => schedule.nextFireAt === null
      )
    ).toBe(true);
    // At least one schedule uses a sample profile
    expect(schedules.some((schedule) => schedule.agentProfile === SAMPLE_PROFILE_IDS[0])).toBe(true);
    // At least one heartbeat schedule exists
    expect(schedules.some((schedule) => schedule.type === "heartbeat")).toBe(true);
    // At least one schedule has delivery channels
    expect(schedules.some((schedule) => schedule.deliveryChannels !== null)).toBe(true);
  });
});
