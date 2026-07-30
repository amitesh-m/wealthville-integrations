/**
 * Core contracts shared by the background worker, content scripts and UI.
 *
 * Everything crossing a message boundary is defined here. Content scripts are
 * untrusted from the worker's point of view — validate shape on receipt rather
 * than assuming these types hold.
 */

export type CaptchaKind =
  | 'recaptcha_v2'
  | 'recaptcha_v2_invisible'
  | 'recaptcha_v3'
  | 'hcaptcha'
  | 'turnstile'
  | 'arkose'
  | 'geetest_v3'
  | 'geetest_v4'
  | 'image';

/** Kinds with no visual challenge — manual mode is meaningless for these. */
export const SCORE_BASED_KINDS: readonly CaptchaKind[] = [
  'recaptcha_v3',
  'recaptcha_v2_invisible',
];

/** What the content script extracted from the page. */
export interface CaptchaTask {
  id: string;
  kind: CaptchaKind;
  /** Site key, public key, or captcha id depending on kind. */
  siteKey: string;
  pageUrl: string;
  tabId: number;
  frameId: number;
  /** reCAPTCHA v3 action name. */
  action?: string;
  /** reCAPTCHA enterprise `data-s`. */
  dataS?: string;
  /** GeeTest v3 challenge, and other kind-specific extras. */
  extra?: Record<string, string>;
}

export type SolveState =
  | 'detected'
  | 'submitted'
  | 'polling'
  | 'injected'
  | 'verified'
  | 'waiting_manual'
  | 'failed';

/**
 * Persisted per task in `chrome.storage.session`. The service worker is evicted
 * between alarm ticks, so this record — not memory — is the source of truth.
 */
export interface TaskRecord {
  task: CaptchaTask;
  state: SolveState;
  providerId?: string;
  jobId?: string;
  token?: string;
  /** Epoch ms the token was minted; tokens go stale at ~120s. */
  tokenAt?: number;
  /** Provider ids already tried and failed, to drive failover. */
  attempted: string[];
  submittedAt?: number;
  error?: string;
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'ready'; token: string }
  | { status: 'error'; error: ProviderError };

export interface ProviderError {
  /** Terminal errors stop this provider; transient ones retry then fail over. */
  kind: 'terminal' | 'transient';
  code: string;
  message: string;
}

export interface Provider {
  readonly id: string;
  readonly label: string;
  readonly supports: readonly CaptchaKind[];
  submit(task: CaptchaTask, apiKey: string): Promise<{ jobId: string }>;
  /**
   * Single non-blocking check. Must not sleep or long-poll internally — the
   * orchestrator drives cadence via `chrome.alarms`.
   */
  poll(jobId: string, apiKey: string): Promise<PollResult>;
  balance?(apiKey: string): Promise<number>;
}

/** How the extension behaves on a given origin. Default is `ask`. */
export type OriginMode = 'auto' | 'manual' | 'ask' | 'off';

export interface OriginPolicy {
  mode: OriginMode;
  /** Start solving on detection rather than at submit. Costs extra solves. */
  preSolve: boolean;
}

export interface Settings {
  /** Global fallback order; `perKind` overrides it where present. */
  providerOrder: string[];
  perKind: Partial<Record<CaptchaKind, string[]>>;
  /** Keyed by provider id. Plaintext in storage — never log these. */
  apiKeys: Record<string, string>;
  origins: Record<string, OriginPolicy>;
  defaultMode: OriginMode;
  /** Use chrome.debugger screencast instead of the companion popup. */
  cdpRemoteView: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  providerOrder: [],
  perKind: {},
  apiKeys: {},
  origins: {},
  defaultMode: 'ask',
  cdpRemoteView: false,
};

/** Token lifetime margin — re-solve past this rather than risk a dead token. */
export const TOKEN_STALE_MS = 100_000;
/** Give a provider this long before failing over. */
export const PROVIDER_TIMEOUT_MS = 90_000;

export type ContentMessage =
  | { type: 'CAPTCHA_DETECTED'; task: Omit<CaptchaTask, 'tabId' | 'frameId'> }
  | { type: 'CAPTCHA_RESOLVED'; taskId: string }
  | { type: 'SUBMIT_INTERCEPTED'; taskId: string };

export type BackgroundMessage =
  | { type: 'INJECT_TOKEN'; taskId: string; token: string; kind: CaptchaKind }
  | { type: 'RELEASE_SUBMIT'; taskId: string }
  | { type: 'SHOW_STATUS'; taskId: string; state: SolveState };
