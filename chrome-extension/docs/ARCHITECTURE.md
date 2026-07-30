# Architecture

## Components

| Component | Context | Responsibility |
| :--- | :--- | :--- |
| `content/detect.ts` | Every frame, every page | Recognise captcha widgets, extract parameters, report to background |
| `content/inject.ts` | Every frame | Write the solved token into the page and invoke the site's callback |
| `background/orchestrator.ts` | Service worker | Own the solve lifecycle; submit, poll, fail over, verify |
| `background/providers/*` | Service worker | One adapter per solving service |
| `manual/` | Popup window | Companion view when a human has to solve it |
| `options/` | Options page | Provider selection, API keys, per-origin policy |

## Solve lifecycle

```
        detected
           │
           ▼
    ┌─────────────┐   origin policy: off
    │ policy gate │──────────────────────────► ignore
    └──────┬──────┘
           │ auto              │ manual / ask
           ▼                   ▼
    ┌─────────────┐      ┌───────────┐
    │  SUBMITTED  │      │  WAITING  │──► companion popup, notify user
    └──────┬──────┘      └─────┬─────┘
           │ alarm poll        │ user solves in page
           ▼                   │
    ┌─────────────┐            │
    │   POLLING   │            │
    └──┬───────┬──┘            │
       │       │ timeout/error │
       │       ▼               │
       │  ┌─────────┐          │
       │  │FAILOVER │─► next provider, or ──► WAITING
       │  └─────────┘          │
       │ token                 │
       ▼                       │
  ┌──────────┐                 │
  │ INJECTED │                 │
  └────┬─────┘                 │
       ▼                       ▼
  ┌──────────┐            ┌──────────┐
  │ VERIFIED │            │ VERIFIED │
  └──────────┘            └──────────┘
```

`VERIFIED` is reached only by observing that the page moved on — navigation
occurred, or the captcha element left the DOM. Writing the token is `INJECTED`,
which is *not* success.

## Why the state lives in storage

The service worker is evicted after roughly 30 seconds of inactivity, and a solve
takes 15–60. So the orchestrator is written as a **resumable state machine**, not
as an async function:

- Each task is a record in `chrome.storage.session` keyed by task id.
- Submitting a job schedules a `chrome.alarms` alarm.
- The alarm handler wakes the worker, loads task records, polls the provider for
  any in-flight ones, advances their state, writes back, and re-arms if work
  remains.

Nothing is held in memory between turns. If you find yourself wanting a
module-level `Map` of pending solves, that is the bug.

## Pre-solving and token expiry

Pre-solve starts a solve when the captcha is *detected* rather than when the form
is submitted, so the latency is spent while the user fills the form. Two rules:

- A token older than **100 seconds** is treated as stale and re-solved if the form
  is still open (reCAPTCHA's own TTL is ~120s; the margin absorbs submit latency).
- Pre-solve is opt-in per origin. Every refresh is a paid solve, and a page the
  user abandons has still cost money.

When the captcha appears only *after* submit — common on logins — there is nothing
to pre-solve. The content script intercepts the submit, holds it, shows an inline
"solving" chip so the page does not look frozen, and releases once the token lands.

## Messaging

Content → background: `CAPTCHA_DETECTED`, `CAPTCHA_RESOLVED`, `SUBMIT_INTERCEPTED`.
Background → content: `INJECT_TOKEN`, `RELEASE_SUBMIT`, `SHOW_STATUS`.
Background → manual popup: `TASK_UPDATE`.

All payloads are plain JSON and defined in `types.ts`. Content scripts are untrusted
input as far as the worker is concerned — validate shape before acting.

## Manual mode

Two variants, chosen in options:

**Companion popup (default).** A small `chrome.windows.create({type:'popup'})` window
listing tabs blocked on a captcha, each with a cropped screenshot
(`chrome.tabs.captureVisibleTab`) and a button that focuses the tab and scrolls the
widget into view. The user solves in the real page; `detect.ts` notices the response
field populate and reports `CAPTCHA_RESOLVED`.

**CDP remote view (opt-in).** Attaches `chrome.debugger`, streams the region with
`Page.startScreencast`, and forwards clicks via `Input.dispatchMouseEvent` — the only
way to deliver *trusted* input into a cross-origin captcha iframe. Requires the
optional `debugger` permission, shows a persistent banner on the tab, and conflicts
with DevTools. Gate it clearly.

## Failure handling

- Provider timeout is 90s, then failover to the next configured provider.
- All providers exhausted → fall back to manual, notify.
- Page re-presents the captcha after `INJECTED` → count as a failed solve for that
  provider (useful signal for score-based types), do not silently retry the same one.
- Bad key / zero balance is terminal for that provider — surface it rather than
  cycling.
