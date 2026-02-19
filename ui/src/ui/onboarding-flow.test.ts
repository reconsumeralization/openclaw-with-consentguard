import { describe, expect, it } from "vitest";
import {
  getOnboardingActionState,
  hasCompletedFirstRun,
  hasConfiguredIntegration,
  getOnboardingNextStep,
  getOnboardingNextTab,
  getOnboardingProgress,
  getOnboardingStepStatusKey,
  getOnboardingSteps,
} from "./onboarding-flow.ts";

describe("onboarding flow", () => {
  it("derives ordered steps from gateway and usage state", () => {
    const steps = getOnboardingSteps({
      connected: true,
      integrationsReady: false,
      firstRunReady: false,
    });

    expect(steps).toEqual([
      { key: "gateway", done: true, tab: "overview" },
      { key: "integrations", done: false, tab: "channels" },
      { key: "firstRun", done: false, tab: "chat" },
    ]);
  });

  it("returns consent as the next tab when onboarding is complete", () => {
    const steps = getOnboardingSteps({
      connected: true,
      integrationsReady: true,
      firstRunReady: true,
    });

    expect(getOnboardingProgress(steps)).toEqual({ done: 3, total: 3 });
    expect(getOnboardingNextStep(steps)).toBeNull();
    expect(getOnboardingNextTab(steps)).toBe("consent");
  });

  it("computes consistent action gating from step state", () => {
    const partial = getOnboardingSteps({
      connected: true,
      integrationsReady: false,
      firstRunReady: false,
    });
    expect(getOnboardingActionState(partial)).toEqual({
      gatewayReady: true,
      integrationsReady: false,
      firstRunReady: false,
      canOpenChat: false,
      canOpenConsent: false,
    });

    const complete = getOnboardingSteps({
      connected: true,
      integrationsReady: true,
      firstRunReady: true,
    });
    expect(getOnboardingActionState(complete)).toEqual({
      gatewayReady: true,
      integrationsReady: true,
      firstRunReady: true,
      canOpenChat: true,
      canOpenConsent: true,
    });
  });

  it("maps step status labels consistently", () => {
    const steps = getOnboardingSteps({
      connected: false,
      integrationsReady: false,
      firstRunReady: false,
    });
    expect(getOnboardingStepStatusKey(steps[0])).toBe("common.offline");
    expect(getOnboardingStepStatusKey(steps[1])).toBe("common.na");
    expect(getOnboardingStepStatusKey(steps[2])).toBe("common.na");
  });

  it("requires an active configured account to mark integrations complete", () => {
    expect(
      hasConfiguredIntegration({
        ts: Date.now(),
        channelOrder: ["telegram"],
        channelLabels: {},
        channels: {},
        channelAccounts: {
          telegram: [{ accountId: "a1", configured: true, enabled: true }],
        },
        channelDefaultAccountId: {},
      }),
    ).toBe(true);

    expect(
      hasConfiguredIntegration({
        ts: Date.now(),
        channelOrder: ["telegram"],
        channelLabels: {},
        channels: {},
        channelAccounts: {
          telegram: [{ accountId: "a1", configured: false, enabled: false }],
        },
        channelDefaultAccountId: {},
      }),
    ).toBe(false);
  });

  it("counts first run only from direct or group sessions", () => {
    expect(
      hasCompletedFirstRun({
        ts: Date.now(),
        path: "",
        count: 1,
        defaults: { model: null, contextTokens: null },
        sessions: [{ key: "global", kind: "global", updatedAt: Date.now() }],
      }),
    ).toBe(false);

    expect(
      hasCompletedFirstRun({
        ts: Date.now(),
        path: "",
        count: 1,
        defaults: { model: null, contextTokens: null },
        sessions: [{ key: "chat", kind: "direct", updatedAt: Date.now() }],
      }),
    ).toBe(true);
  });
});
