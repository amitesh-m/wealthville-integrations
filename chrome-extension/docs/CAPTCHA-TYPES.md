# Captcha types — detection and injection

One section per supported type. Detection selectors go in `content/detect.ts`;
injection recipes in `content/inject.ts`.

Verify every recipe here against a live page before trusting it — vendors change
internals, and a stale selector fails silently.

---

## reCAPTCHA v2 (checkbox)

**Detect**
- `.g-recaptcha[data-sitekey]`, or `iframe[src*="google.com/recaptcha/api2/anchor"]`
- Sitekey: `data-sitekey` attribute, or the `k` query param of the iframe `src`

**Solve params**: `sitekey`, `pageurl`. Add `data-s` if present (enterprise variants).

**Inject**
1. Write the token into `textarea#g-recaptcha-response` (make it visible to scripts —
   it is `display:none` by default, which is fine, but some sites query it by id).
2. Invoke the site callback. Walk `___grecaptcha_cfg.clients` for a member whose
   `callback` is a function and call it with the token. The widget's own checkbox may
   not visually tick — cosmetic, the server validates the token.

**Automatic viability**: good. This is the case that feels invisible.

---

## reCAPTCHA v2 (invisible) and v3

**Detect**
- v3: `script[src*="recaptcha/api.js?render="]` — sitekey is the `render` param
- invisible v2: `.g-recaptcha[data-size="invisible"]`

**Solve params**: `sitekey`, `pageurl`, plus `action` for v3 (read from the site's
`grecaptcha.execute(key, {action})` call — often needs a page-script hook, not just DOM).

**Automatic viability**: partial. v3 is score-based; a provider-minted token can score
below the site's threshold and be rejected despite being structurally valid. Expect
failures that are not bugs. There is no visual challenge, so **manual mode does not
apply** — detect this and skip the popup rather than showing an empty box.

---

## hCaptcha

**Detect**: `.h-captcha[data-sitekey]`, or `iframe[src*="hcaptcha.com"]`

**Inject**: write to both `textarea[name="h-captcha-response"]` and
`textarea[name="g-recaptcha-response"]` — many sites read the latter for
compatibility — then invoke the callback from `hcaptcha` config.

**Automatic viability**: good.

---

## Cloudflare Turnstile

**Detect**: `.cf-turnstile[data-sitekey]`, or `iframe[src*="challenges.cloudflare.com"]`

**Inject**: `input[name="cf-turnstile-response"]` plus the site callback.

**Automatic viability**: mixed, and worst for the full-page "Checking your browser"
interstitial, which is pre-render and bound tightly to browser fingerprint and IP.
A token solved from the provider's network often fails validation. Providers that
accept a user-supplied proxy improve this materially — support passing one.

---

## Arkose Labs / FunCaptcha

**Detect**: `iframe[src*="arkoselabs.com"]`, `#funcaptcha`, `[data-pkey]`
**Solve params**: `publickey` (the `data-pkey`), `pageurl`, and often a `surl`.
**Automatic viability**: works, slower and pricier than reCAPTCHA.

---

## GeeTest (v3 / v4)

**Detect**: `.geetest_holder`, `script[src*="geetest"]`
**Solve params**: v3 needs `gt` + `challenge`; v4 needs `captcha_id`. Both usually
come from a page XHR, so this needs a network hook rather than DOM scraping.
**Automatic viability**: works; the parameter extraction is the fiddly part.

---

## Plain image captchas

**Detect**: no universal fingerprint — requires a per-site rule (image selector +
input selector) configured in options.

**Solve**: base64 the image, send to the provider's generic image-to-text endpoint
with an optional instruction string, write the answer into the input.

**Automatic viability**: good where configured, but it is manual configuration per
site by definition.
