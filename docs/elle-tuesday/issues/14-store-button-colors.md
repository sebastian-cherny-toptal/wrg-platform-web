# 14 — Finish store action-button color changes

**Category:** enhancement
**State:** fixed locally

## Agent Brief

**Current behavior:** Main store purchase buttons are dark purple, but some prominent actions in the store-to-checkout flow remain red, including the checkout navigation button. Elle asked for red buttons to become darker purple or green.

**Desired behavior:** Store, cart, checkout, and promotional store-entry action buttons use the existing dark-purple primary or green success treatment consistently. Error messages, removal/destructive controls, charts, and prices may retain semantic red.

**Key interfaces:** Client action-button variants and store/checkout call-to-action components. Prefer one shared treatment over scattered one-off colors.

**Acceptance criteria:**

- [x] No store-flow primary or promotional action button uses a red fill or red text treatment.
- [x] Hover, focus, disabled, and contrast states remain legible.
- [x] Error and destructive affordances remain distinguishable.
- [x] Narrow and desktop store/cart/checkout screens are visually checked.

**Out of scope:** Rebranding report charts, changing price text, or recoloring unrelated admin controls.

**Verification:** Inspect the relevant action components and capture before/after store-flow screenshots; run focused client checks.

## Resolution

The client now shares a dark-violet store action treatment across purchase buttons, checkout navigation, and promotional store-entry overlays. Store-entry text links use matching dark-violet text with hover and keyboard-focus states. Semantic red remains on prices, error messages, and removal controls. The API catalog and commerce routes carry data only and needed no color change.

The Playwright store-flow test reproduced the red treatment before the fix and passes afterward in desktop Chromium and mobile Chrome. It checks hover, keyboard focus, and disabled states. Before and after screenshots of the promotional dashboard, store, cart, and checkout are saved under the workspace `outputs/issue14-before` and `outputs/issue14-after` directories. Focused client tests, lint, and the client build pass.
