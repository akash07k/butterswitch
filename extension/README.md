# butterswitch-extension

The WXT browser extension. The repository root has the project README, contributing guide, and license — see [`../README.md`](../README.md).

## Layout

```text
config/         tunables (defaults, theme registry, event defaults)
core/           module system, message bus, settings store, messaging
modules/        feature modules (only sound-engine so far)
entrypoints/    background, popup, options, offscreen
shared/         a11y utilities, platform detection
components/     shadcn/ui components
public/         icons, sound files (theme assets)
store-listing/  copy uploaded to Chrome Web Store and Firefox AMO
scripts/        local helpers (postinstall, submit)
```

## Local development

```sh
pnpm dev           # Chrome with HMR
pnpm dev:firefox   # Firefox

pnpm build
pnpm build:firefox

pnpm zip           # Chrome zip into .output/
pnpm zip:firefox   # Firefox zip + sources zip
```

## Browser support

Chrome 140 or later (MV3, service worker). Firefox 142 or later (MV2, background page).

## Submission

Day-to-day, you don't run the submission scripts directly — `pnpm release` plus `git push --follow-tags` triggers the CI workflow that submits to the stores. These scripts are here for local debugging:

```sh
pnpm submit:init      # one-time: write .env.submit with store credentials
pnpm submit:dry-run   # verify credentials, no real submission
pnpm submit           # submit for real
```

See the contributing guide and the WXT publishing docs for credential setup.
