# 14 — Finish store action-button color changes

**Category:** enhancement
**State:** ready-for-agent

## Agent Brief

**Current behavior:** Main store purchase buttons are dark purple, but some prominent actions in the store-to-checkout flow remain red, including the checkout navigation button. Elle asked for red buttons to become darker purple or green.

**Desired behavior:** Store, cart, checkout, and promotional store-entry action buttons use the existing dark-purple primary or green success treatment consistently. Error messages, removal/destructive controls, charts, and prices may retain semantic red.

**Key interfaces:** Client action-button variants and store/checkout call-to-action components. Prefer one shared treatment over scattered one-off colors.

**Acceptance criteria:**

- [ ] No store-flow primary or promotional action button uses a red fill or red text treatment.
- [ ] Hover, focus, disabled, and contrast states remain legible.
- [ ] Error and destructive affordances remain distinguishable.
- [ ] Narrow and desktop store/cart/checkout screens are visually checked.

**Out of scope:** Rebranding report charts, changing price text, or recoloring unrelated admin controls.

**Verification:** Inspect the relevant action components and capture before/after store-flow screenshots; run focused client checks.
