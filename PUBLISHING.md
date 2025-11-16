Publishing releases & Auto-updates

This repository is configured to publish Windows releases to GitHub Releases and to support in-app updates via electron-updater.

Quick summary

- `package.json` already contains `build.publish` pointing to `KimmyOGato/unwanted-wayback-tools`.
- There is an `npm run release` script which runs `electron-builder --publish=always`.
- A GitHub Actions workflow `.github/workflows/release.yml` is provided and will run when you create a Release on GitHub.

Options to publish

1) Automatic publish via GitHub (recommended)

   - Create a GitHub Release at:
     https://github.com/KimmyOGato/unwanted-wayback-tools/releases
   - The workflow will build and publish the artifacts (NSIS installer, blockmap, latest.yml) automatically using the repository's `GITHUB_TOKEN`.

2) Manual publish from your machine

   - Optionally set a token in your local environment for electron-builder to use:
     ```powershell
     $env:GITHUB_TOKEN = 'ghp_...'
     ```
   - Then run:
     ```powershell
     npm run release
     ```
   - This will build the app, generate the icon, and run electron-builder with `--publish=always` to upload artifacts to the release.

Testing the updater

- After publishing a release and installing the produced installer locally (download the installer from the release and run it), open the installed app and click "Check for updates".
- If a newer release exists, the app will show the "Update available" prompt. The app will only download if the user confirms, and after download it will prompt to "Install and Restart".

Notes and gotchas

- Auto-updates only work correctly for installed builds (the installer). Running `electron .` or in dev mode will not behave identically — the main process handlers return `updater_unavailable` when `electron-updater` isn't present or when running in dev.
- Ensure the `version` in `package.json` matches the release tag you publish — `electron-updater` uses the app version to detect updates.
- To avoid Windows SmartScreen/installer warnings, sign the installer (code signing). This requires setting signing secrets/certificates in your CI (GitHub Actions) and configuring electron-builder accordingly.
- If you want me to add a short README section linking to this `PUBLISHING.md`, tell me and I'll insert it into `README.md` (I left the README unchanged because editing the fenced block failed in this session).