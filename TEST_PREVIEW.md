# Isolated fixture test build

This branch builds only the fixture UI from the existing repository. It uses the original branding and OverviewCards components. No production app server, authentication backend, billing route, or live collector is bundled. Platform protection must be verified on the returned deployment URL. All fixture records stay in the current browser's localStorage. This is not a verification of live research, payment, account login, or database persistence. The original application and prior unmerged repair checkouts remain preserved.

Run fixture regressions with Node 24: node --experimental-strip-types --test anything/_/apps/web/tests/fixture-preview.test.mjs
