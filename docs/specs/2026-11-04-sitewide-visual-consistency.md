# Sitewide visual consistency

## Approved reference and scope

The user explicitly requested that the whole site look like the existing home
page. That shipped homepage is the visual specification, not a new design
direction requiring another approval. Their standing instruction covers commit,
push and deployment to the existing osintshadow-test Preview. No Production.

Use the homepage's graphite/ice-blue palette, original logo, Inter typography,
fine borders, restrained corners, spacious headings and accessible focus states.
Extend the established visual system rather than inventing a second brand.

## Surfaces

- Shared root background and theme for all routes, including loading/error states.
- Sign-in, signup, forgot/reset password and sign-out: shared branded two-column
  account shell; mobile stacks content above the form. Real form handlers stay.
- Dashboard, investigations list/new/detail and all detail tabs, AI chat, map,
  billing, settings, administration and debug: consistent workspace surfaces,
  navigation, headings, inputs, cards and primary actions.
- Existing report viewer is themed. Downloaded/printed document formats remain
  unchanged for legibility and to avoid changing report content or escaping.

## Design system

Colors: background #080d12; panel #0f171f; inset #0b131a; elevated #14222d;
border #26323d; hover #1d2d37; accent #8edfff; accent hover #b9ecff;
primary text #f3f7f9; secondary text #a2b2be. Keep semantic error/warning/success
colors distinct; don't turn findings into success merely by recoloring them.

Type: Inter/Segoe UI/Arial, tight 32–48px workspace/account headings, 14–16px
form/body text, 10–11px mono section labels. Spacing: 4px rhythm; 24–48px section
padding; 44px minimum controls. Corners: 5px controls, 8px panels. Shadows only
on the account form/illustration, not every data card.

Motion: restrained entry fade/hover; reduced-motion disables optional animation.
All content remains visible without animation. Mobile breakpoint 768px; desktop
workspace sidebar remains 244px, collapsible using existing controls.

## Preservation and acceptance

Do not change API requests, authentication/callbacks, provider options, processing,
credits, prices, admin gates, report content, stored records or assets. No installs,
credential entry, live investigations, account creation or paid calls for testing.
Hydration investigation is a separate known open issue, not part of this change.

Check source syntax, static rendering with synthetic fixtures, accessibility labels,
theme coverage across every UI route, unchanged handlers, full local regression,
hosted Windows/Linux typecheck/test/build/smoke, exact remote SHA and Preview ID.
Verify public account screens on deployed desktop/mobile without submitting forms.
Do not claim live authenticated workflow acceptance from fixture rendering.
