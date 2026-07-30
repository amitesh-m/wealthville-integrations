# Solving providers

## The contract

Every service is wrapped in an adapter implementing `Provider` (`src/types.ts`).
Adding a service means adding one file under `background/providers/` and one line
in `background/providers/index.ts`. If a change requires touching the orchestrator,
the abstraction is wrong — fix the interface instead.

```ts
interface Provider {
  readonly id: string;
  readonly label: string;
  readonly supports: CaptchaKind[];
  submit(task: CaptchaTask, key: string): Promise<{ jobId: string }>;
  poll(jobId: string, key: string): Promise<PollResult>;   // pending | token | error
  balance?(key: string): Promise<number>;
}
```

`poll` must never block or sleep internally — the orchestrator drives the cadence
from `chrome.alarms`, because the service worker will be evicted mid-wait otherwise.

Errors are classified, not just thrown: **terminal** (bad key, no balance,
unsupported type) stops that provider and surfaces to the user; **transient**
(network, rate limit, capacity) is retried then failed over.

## Services to wire

Start with the first two — between them they cover the widest range of captcha
types, which lets the failover path be exercised for real from day one.

| Service | Notes |
| :--- | :--- |
| **2Captcha** | Broadest type coverage, cheapest for reCAPTCHA v2, generic image-to-text endpoint. Legacy `in.php`/`res.php` API plus a newer JSON API — use the JSON one. |
| **CapSolver** | Strongest on Turnstile and Enterprise variants. Clean JSON API, task-based. |
| CapMonster | Anti-Captcha-compatible API shape; adapter is largely shared with Anti-Captcha. |
| Anti-Captcha | `createTask` / `getTaskResult`. |
| DeathByCaptcha | Older API, add only if wanted. |

Each provider's API host must be added explicitly to `host_permissions` in the
manifest. Do not use a wildcard.

## Selection and failover

Options page holds an ordered provider list with a key per provider. Selection is
per captcha kind — a service that is best at Turnstile need not be the one used for
image grids — so the config is `kind -> ordered provider ids`, defaulting to the
global order.

Failover walks that list on transient failure and on token rejection by the page,
skipping providers whose `supports` does not include the kind.

## Keys and cost

- Keys live in `chrome.storage.sync`. This is **plaintext** to anything with access
  to the browser profile. Say so in the README; do not describe it as secure.
- Never log a key, and redact it from error messages before they reach storage or
  the UI.
- Show remaining balance in the popup where the provider exposes it. Running out
  mid-session otherwise looks like the extension broke.
- Rough order of magnitude at time of writing: reCAPTCHA v2 and hCaptcha are the
  cheap tier, Turnstile and Enterprise several times that. Pre-solving every captcha
  on every page visited will spend real money on forms the user never submits —
  which is why pre-solve is opt-in per origin.
