import type { Tab } from "./navigation.ts";
import type { ChannelsStatusSnapshot, SessionsListResult } from "./types.ts";

export type OnboardingStepKey = "gateway" | "integrations" | "firstRun";

export type OnboardingStep = {
  key: OnboardingStepKey;
  done: boolean;
  tab: Tab;
};

export type OnboardingFlowInput = {
  connected: boolean;
  integrationsReady: boolean;
  firstRunReady: boolean;
};

export function getOnboardingSteps(input: OnboardingFlowInput): OnboardingStep[] {
  return [
    { key: "gateway", done: input.connected, tab: "overview" },
    { key: "integrations", done: input.integrationsReady, tab: "channels" },
    { key: "firstRun", done: input.firstRunReady, tab: "chat" },
  ];
}

export function getOnboardingProgress(steps: OnboardingStep[]) {
  const done = steps.filter((step) => step.done).length;
  const total = steps.length;
  return { done, total };
}

export function getOnboardingNextStep(steps: OnboardingStep[]) {
  return steps.find((step) => !step.done) ?? null;
}

export function getOnboardingNextTab(steps: OnboardingStep[]): Tab {
  return getOnboardingNextStep(steps)?.tab ?? "consent";
}

export function getOnboardingStepStatusKey(step: OnboardingStep): "common.ok" | "common.offline" | "common.na" {
  if (step.done) {
    return "common.ok";
  }
  return step.key === "gateway" ? "common.offline" : "common.na";
}

export type OnboardingActionState = {
  gatewayReady: boolean;
  integrationsReady: boolean;
  firstRunReady: boolean;
  canOpenChat: boolean;
  canOpenConsent: boolean;
};

export function getOnboardingActionState(steps: OnboardingStep[]): OnboardingActionState {
  const gatewayReady = steps.some((step) => step.key === "gateway" && step.done);
  const integrationsReady = steps.some((step) => step.key === "integrations" && step.done);
  const firstRunReady = steps.some((step) => step.key === "firstRun" && step.done);

  return {
    gatewayReady,
    integrationsReady,
    firstRunReady,
    canOpenChat: gatewayReady && integrationsReady,
    canOpenConsent: firstRunReady,
  };
}

function isTruthyFlag(value: unknown): boolean {
  return value === true;
}

function isAccountActive(account: unknown): boolean {
  if (!account || typeof account !== "object") {
    return false;
  }
  const entry = account as {
    connected?: unknown;
    linked?: unknown;
    running?: unknown;
    configured?: unknown;
    enabled?: unknown;
    probe?: unknown;
  };
  const probeOk =
    entry.probe && typeof entry.probe === "object" && "ok" in entry.probe
      ? (entry.probe as { ok?: unknown }).ok === true
      : false;
  const configuredAndEnabled =
    isTruthyFlag(entry.configured) && entry.enabled !== false;
  return (
    isTruthyFlag(entry.connected) ||
    isTruthyFlag(entry.linked) ||
    isTruthyFlag(entry.running) ||
    probeOk ||
    configuredAndEnabled
  );
}

export function hasConfiguredIntegration(snapshot: ChannelsStatusSnapshot | null): boolean {
  if (!snapshot) {
    return false;
  }
  const accountGroups = Object.values(snapshot.channelAccounts ?? {});
  return accountGroups.some((group) => Array.isArray(group) && group.some((account) => isAccountActive(account)));
}

export function hasCompletedFirstRun(sessionsResult: SessionsListResult | null): boolean {
  if (!sessionsResult?.sessions?.length) {
    return false;
  }
  return sessionsResult.sessions.some((session) => {
    if (session.kind !== "direct" && session.kind !== "group") {
      return false;
    }
    return typeof session.updatedAt === "number" && session.updatedAt > 0;
  });
}
