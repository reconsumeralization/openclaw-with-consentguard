import { html, nothing } from "lit";
import type { DevicePairingList } from "../controllers/devices.ts";
import type { GatewayHelloOk } from "../gateway.ts";
import { icons } from "../icons.ts";
import type { ChannelAccountSnapshot, ChannelsStatusSnapshot, StatusSummary } from "../types.ts";

type SecurityAuditFinding = {
  level: "critical" | "warn" | "info";
  message: string;
  detail?: string;
};

type SecurityAudit = {
  summary?: { critical?: number; warn?: number; info?: number };
  findings?: SecurityAuditFinding[];
};

export type SecurityProps = {
  loading: boolean;
  status: StatusSummary | null;
  hello: GatewayHelloOk | null;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  devicesList: DevicePairingList | null;
  connected: boolean;
  onRefresh: () => void;
};

type CheckItem = {
  label: string;
  description: string;
  status: "pass" | "fail" | "warn" | "unknown";
};

function dmPolicyLabel(policy: string | null | undefined): string {
  if (!policy) return "open";
  return policy;
}

function dmPolicyTone(policy: string | null | undefined): string {
  if (!policy || policy === "open") return "warn";
  if (policy === "pairing") return "success";
  return "info";
}

function renderCheckItem(item: CheckItem) {
  const tone =
    item.status === "pass"
      ? "ok"
      : item.status === "fail"
        ? "danger"
        : item.status === "warn"
          ? "warn"
          : "muted";
  const icon =
    item.status === "pass"
      ? icons.checkCircle
      : item.status === "fail"
        ? icons.xCircle
        : item.status === "warn"
          ? icons.alertTriangle
          : icons.circle;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${item.label}</div>
        <div class="list-sub">${item.description}</div>
      </div>
      <div class="list-meta">
        <span class="stat-value ${tone}" style="font-size: 0.85rem;">${icon}</span>
      </div>
    </div>
  `;
}

export function renderSecurity(props: SecurityProps) {
  // --- Security audit from status ---
  const securityAudit =
    props.status && typeof props.status === "object"
      ? (props.status as { securityAudit?: SecurityAudit }).securityAudit
      : null;
  const auditSummary = securityAudit?.summary ?? null;
  const auditFindings = (securityAudit?.findings ?? []) as SecurityAuditFinding[];
  const criticalCount = auditSummary?.critical ?? 0;
  const warnCount = auditSummary?.warn ?? 0;
  const infoCount = auditSummary?.info ?? 0;

  const postureTone = !props.connected
    ? ""
    : criticalCount > 0
      ? "danger"
      : warnCount > 0
        ? "warn"
        : auditSummary
          ? "success"
          : "";

  const postureLabel = !props.connected
    ? "Disconnected"
    : criticalCount > 0
      ? `${criticalCount} Critical Issue${criticalCount === 1 ? "" : "s"}`
      : warnCount > 0
        ? `${warnCount} Warning${warnCount === 1 ? "" : "s"}`
        : auditSummary
          ? "No critical issues"
          : "Not loaded";

  // --- Auth mode from hello snapshot ---
  const snapshot = props.hello?.snapshot as
    | { authMode?: string; uptimeMs?: number }
    | undefined;
  const authMode = snapshot?.authMode ?? null;
  const authTone =
    authMode === "none"
      ? "danger"
      : authMode === "token" || authMode === "password" || authMode === "trusted-proxy"
        ? "success"
        : "warn";
  const authLabel =
    authMode === "none"
      ? "None — open access!"
      : authMode === "token"
        ? "Token"
        : authMode === "password"
          ? "Password"
          : authMode === "trusted-proxy"
            ? "Trusted Proxy"
            : authMode
              ? String(authMode)
              : "Unknown";

  // --- DM policies per channel ---
  const channelAccounts = props.channelsSnapshot?.channelAccounts ?? {};
  const channelLabels = props.channelsSnapshot?.channelLabels ?? {};
  const channelOrder = props.channelsSnapshot
    ? (props.channelsSnapshot.channelMeta?.map((m) => m.id) ??
      props.channelsSnapshot.channelOrder)
    : [];

  type DmEntry = {
    channelId: string;
    label: string;
    accountId: string;
    policy: string | null | undefined;
    allowFrom: string[] | null | undefined;
  };
  const dmEntries: DmEntry[] = [];
  for (const channelId of channelOrder) {
    const accounts: ChannelAccountSnapshot[] = channelAccounts[channelId] ?? [];
    for (const acc of accounts) {
      if (acc.dmPolicy !== undefined) {
        dmEntries.push({
          channelId,
          label: channelLabels[channelId] ?? channelId,
          accountId: acc.accountId,
          policy: acc.dmPolicy,
          allowFrom: acc.allowFrom,
        });
      }
    }
  }

  const openDmCount = dmEntries.filter(
    (e) => !e.policy || e.policy === "open",
  ).length;
  const dmTone = openDmCount > 0 ? "warn" : dmEntries.length > 0 ? "success" : "";

  // --- Device pairing ---
  const pendingDevices = props.devicesList?.pending ?? [];
  const pairedDevices = props.devicesList?.paired ?? [];

  // --- Build red team / pen test checklist ---
  const checks: CheckItem[] = [
    {
      label: "Gateway authentication enabled",
      description:
        authMode && authMode !== "none"
          ? `Auth mode: ${authLabel}`
          : "No auth configured — anyone who can reach the gateway WS has full access.",
      status:
        !props.connected
          ? "unknown"
          : authMode && authMode !== "none"
            ? "pass"
            : "fail",
    },
    {
      label: "DM policy is not open on any channel",
      description:
        openDmCount > 0
          ? `${openDmCount} channel account${openDmCount === 1 ? "" : "s"} use open DM policy — unknown senders can reach the agent.`
          : dmEntries.length > 0
            ? "All channel accounts use pairing-based DM policy."
            : "No channel accounts with DM policy found (channels may not be configured).",
      status:
        !props.connected
          ? "unknown"
          : dmEntries.length === 0
            ? "unknown"
            : openDmCount > 0
              ? "warn"
              : "pass",
    },
    {
      label: "No pending device pairing requests",
      description:
        pendingDevices.length > 0
          ? `${pendingDevices.length} device${pendingDevices.length === 1 ? "" : "s"} awaiting approval in Nodes → Devices.`
          : props.devicesList
            ? "No pending pairing requests."
            : "Device list not loaded (visit Nodes to load).",
      status:
        !props.connected
          ? "unknown"
          : !props.devicesList
            ? "unknown"
            : pendingDevices.length > 0
              ? "warn"
              : "pass",
    },
    {
      label: "HTTPS / WSS for remote access",
      description:
        "Use Tailscale Serve or a reverse proxy with TLS when accessing the dashboard remotely. Plain HTTP exposes credentials to network interception.",
      status: "unknown",
    },
    {
      label: "Token rotated after sharing",
      description:
        "If you have shared a tokenized dashboard URL, rotate the gateway token with: openclaw doctor --generate-gateway-token",
      status: "unknown",
    },
    {
      label: "Exec approval policy configured",
      description:
        "Exec approval policies limit which shell commands agents can run without human sign-off. Configure in Nodes → Exec Approvals.",
      status: "unknown",
    },
    {
      label: "Agent tool profiles restricted",
      description:
        "Restrict agent tool access via tool profiles (Agents → Tools). Default 'full' profile gives agents broad capabilities.",
      status: "unknown",
    },
  ];

  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnChecks = checks.filter((c) => c.status === "warn").length;
  const unknownCount = checks.filter((c) => c.status === "unknown").length;

  return html`
    <section class="grid grid-cols-2">
      <!-- Security Posture Card -->
      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="card-title">Security Posture</div>
            <div class="card-sub">
              ${
                auditSummary
                  ? "From gateway security audit."
                  : "Load debug data to run security audit."
              }
            </div>
          </div>
          <button
            class="btn"
            ?disabled=${props.loading || !props.connected}
            @click=${props.onRefresh}
          >
            ${props.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Overall</div>
            <div class="stat-value ${postureTone}">${postureLabel}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Critical</div>
            <div class="stat-value ${criticalCount > 0 ? "danger" : "ok"}">${
              auditSummary ? String(criticalCount) : "—"
            }</div>
          </div>
          <div class="stat">
            <div class="stat-label">Warnings</div>
            <div class="stat-value ${warnCount > 0 ? "warn" : "ok"}">${
              auditSummary ? String(warnCount) : "—"
            }</div>
          </div>
          <div class="stat">
            <div class="stat-label">Info</div>
            <div class="stat-value">${auditSummary ? String(infoCount) : "—"}</div>
          </div>
        </div>
        ${
          !props.connected
            ? html`<div class="callout danger" style="margin-top: 14px">Not connected to gateway.</div>`
            : !auditSummary
              ? html`<div class="callout" style="margin-top: 14px">
                  Run
                  <span class="mono">openclaw security audit --deep</span>
                  for a full security report, or click Refresh to load the summary.
                </div>`
              : nothing
        }
        ${
          auditFindings.length > 0
            ? html`
              <div style="margin-top: 14px;">
                <div class="muted" style="margin-bottom: 8px;">Findings</div>
                <div class="list">
                  ${auditFindings.map(
                    (f) => html`
                      <div class="list-item">
                        <div class="list-main">
                          <div class="list-title">${f.message}</div>
                          ${f.detail ? html`<div class="list-sub">${f.detail}</div>` : nothing}
                        </div>
                        <div class="list-meta">
                          <span class="pill ${f.level === "critical" ? "danger" : f.level === "warn" ? "warn" : ""}">
                            ${f.level}
                          </span>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              </div>
            `
            : nothing
        }
      </div>

      <!-- Auth & Access Card -->
      <div class="card">
        <div class="card-title">Authentication &amp; Access</div>
        <div class="card-sub">Gateway auth mode and connection credentials review.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Auth Mode</div>
            <div class="stat-value ${authTone}">${authLabel}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Gateway Connection</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">${
              props.connected ? "Connected" : "Offline"
            }</div>
          </div>
        </div>
        <div class="stack" style="margin-top: 14px;">
          ${
            authMode === "none"
              ? html`<div class="callout danger">
                  Auth mode is <strong>none</strong>. Anyone who can reach the WebSocket endpoint
                  has full gateway access. Set a token with
                  <span class="mono">openclaw doctor --generate-gateway-token</span>.
                </div>`
              : authMode === "token"
                ? html`<div class="callout success">
                    Token auth is active. Keep the token secret and rotate it after sharing dashboard
                    URLs.
                  </div>`
                : authMode === "password"
                  ? html`<div class="callout">
                      Password auth is active. Prefer token auth for programmatic access; passwords
                      are stored in session only.
                    </div>`
                  : authMode === "trusted-proxy"
                    ? html`<div class="callout success">
                        Trusted proxy auth — authentication is delegated to the upstream proxy.
                        Ensure the proxy enforces auth before forwarding requests.
                      </div>`
                    : nothing
          }
          <div class="note-grid" style="margin-top: 12px;">
            <div>
              <div class="note-title">Token rotation</div>
              <div class="muted">
                Regenerate the gateway token after sharing URLs:
                <span class="mono">openclaw doctor --generate-gateway-token</span>
              </div>
            </div>
            <div>
              <div class="note-title">Tailscale Serve</div>
              <div class="muted">
                Expose the gateway over HTTPS with Tailscale Serve to prevent credential
                interception on plain HTTP.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- DM Policy Section -->
    <section class="card" style="margin-top: 18px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">DM Policies</div>
          <div class="card-sub">
            Per-channel direct-message access control. Open policy allows any sender to reach the
            agent.
          </div>
        </div>
        ${
          dmEntries.length > 0
            ? html`<span class="pill ${dmTone}">${
                openDmCount > 0
                  ? `${openDmCount} open`
                  : `All pairing-gated`
              }</span>`
            : nothing
        }
      </div>
      <div style="margin-top: 14px;">
        ${
          dmEntries.length === 0
            ? html`<div class="muted">
                No channel accounts with DM policy data loaded. Visit Channels to configure and
                load channel status.
              </div>`
            : html`
              <div class="list">
                ${dmEntries.map(
                  (entry) => html`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${entry.label}</div>
                        <div class="list-sub">
                          Account: ${entry.accountId}
                          ${
                            entry.allowFrom && entry.allowFrom.length > 0
                              ? html` · ${entry.allowFrom.length} sender${entry.allowFrom.length === 1 ? "" : "s"} allowlisted`
                              : nothing
                          }
                        </div>
                      </div>
                      <div class="list-meta">
                        <span class="pill ${dmPolicyTone(entry.policy)}">
                          ${dmPolicyLabel(entry.policy)}
                        </span>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
        }
        ${
          openDmCount > 0
            ? html`<div class="callout warn" style="margin-top: 12px;">
                ${openDmCount} channel account${openDmCount === 1 ? "" : "s"} use the
                <strong>open</strong> DM policy. Switch to <strong>pairing</strong> to require
                short-code approval for new senders. Set
                <span class="mono">dmPolicy: "pairing"</span> in the channel config.
              </div>`
            : nothing
        }
      </div>
    </section>

    <!-- Device Pairing Section -->
    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Device Pairing</div>
      <div class="card-sub">Pending and approved device pairings.</div>
      <div class="stat-grid" style="margin-top: 14px;">
        <div class="stat">
          <div class="stat-label">Pending Requests</div>
          <div class="stat-value ${pendingDevices.length > 0 ? "warn" : "ok"}">
            ${props.devicesList ? String(pendingDevices.length) : "—"}
          </div>
        </div>
        <div class="stat">
          <div class="stat-label">Paired Devices</div>
          <div class="stat-value">${props.devicesList ? String(pairedDevices.length) : "—"}</div>
        </div>
      </div>
      ${
        pendingDevices.length > 0
          ? html`<div class="callout warn" style="margin-top: 12px;">
              ${pendingDevices.length} device pairing request${pendingDevices.length === 1 ? "" : "s"} awaiting approval.
              Review and approve or reject in
              <strong>Nodes → Devices</strong>.
            </div>`
          : nothing
      }
      ${
        !props.devicesList
          ? html`<div class="muted" style="margin-top: 12px;">
              Device list not loaded. Visit Nodes to load pairing data.
            </div>`
          : nothing
      }
    </section>

    <!-- Red Team / Pen Test Checklist -->
    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Red Team Checklist</div>
      <div class="card-sub">
        Self-assessment for security hardening. Items marked
        <strong>unknown</strong> require manual verification.
      </div>
      <div class="row" style="margin-top: 10px; gap: 18px;">
        <span class="muted" style="font-size: 0.85rem;">
          Pass: ${passCount} &nbsp;·&nbsp; Fail: ${failCount} &nbsp;·&nbsp;
          Warn: ${warnChecks} &nbsp;·&nbsp; Manual: ${unknownCount}
        </span>
      </div>
      <div class="list" style="margin-top: 14px;">
        ${checks.map(renderCheckItem)}
      </div>
      <div class="callout" style="margin-top: 14px;">
        <strong>Deep audit:</strong> Run
        <span class="mono">openclaw security audit --deep</span> from the command line for a full
        gateway security report with remediation steps.
      </div>
    </section>

    <!-- Onboarding / Hardening Quick Reference -->
    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Onboarding &amp; Hardening Reference</div>
      <div class="card-sub">Common security hardening commands and configuration pointers.</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">Initial setup</div>
          <div class="muted">
            Run <span class="mono">openclaw onboard</span> to walk through gateway, channel, and
            model setup with security defaults applied.
          </div>
        </div>
        <div>
          <div class="note-title">Generate gateway token</div>
          <div class="muted">
            <span class="mono">openclaw doctor --generate-gateway-token</span>
            — create or rotate the gateway auth token.
          </div>
        </div>
        <div>
          <div class="note-title">Security audit</div>
          <div class="muted">
            <span class="mono">openclaw security audit --deep</span>
            — full gateway security scan with remediation output.
          </div>
        </div>
        <div>
          <div class="note-title">Doctor check</div>
          <div class="muted">
            <span class="mono">openclaw doctor</span>
            — validates config, DM policies, and flags high-risk settings.
          </div>
        </div>
        <div>
          <div class="note-title">DM pairing policy</div>
          <div class="muted">
            Set <span class="mono">dmPolicy: "pairing"</span> on channel accounts to require
            short-code approval before unknown senders can reach the agent.
          </div>
        </div>
        <div>
          <div class="note-title">Exec approval policy</div>
          <div class="muted">
            Configure <span class="mono">tools.exec.approvals</span> to require human sign-off
            before the agent can execute shell commands.
          </div>
        </div>
        <div>
          <div class="note-title">Tool profile restriction</div>
          <div class="muted">
            Use agent tool profiles (<span class="mono">tools.profile: "minimal"</span>) to limit
            what tools an agent can access.
          </div>
        </div>
        <div>
          <div class="note-title">HTTPS / Tailscale</div>
          <div class="muted">
            Use Tailscale Serve or a TLS-terminating reverse proxy so dashboard credentials and
            session tokens are never sent in plaintext.
          </div>
        </div>
      </div>
    </section>
  `;
}
