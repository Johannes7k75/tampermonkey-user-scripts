# Tampermonkey User Scripts

Install a script by opening its raw GitHub URL in a browser with Tampermonkey
installed. Tampermonkey will show the installation screen.

## Install scripts

[![Install Clone with VSCode](https://img.shields.io/badge/Install-Clone%20with%20VSCode-2ea44f?logo=tampermonkey)](https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/clone-with-vscode.user.js)

[![Install AniWorld Filler highlighter](https://img.shields.io/badge/Install-AniWorld%20Filler%20highlighter-2ea44f?logo=tampermonkey)](https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/filler-highlighter.user.js)

[![Install Jitsi Video Capture](https://img.shields.io/badge/Install-Jitsi%20Video%20Capture-2ea44f?logo=tampermonkey)](https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/jitsi-video-capture.user.js)

[![Install Stream Watchtool](https://img.shields.io/badge/Install-Stream%20Watchtool-2ea44f?logo=tampermonkey)](https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/latest/download/stream-watchtool.user.js)

Each script contains its own `@version`. All scripts use the latest GitHub
Release as their update source.

To publish a release, update the relevant tool version in its `package.json`,
commit the change, then create and push a repository tag:

```bash
git tag v4.0.0
git push origin v4.0.0
```

The workflow discovers each per-script metadata file and uses a build matrix,
then attaches these assets to the release:

```text
clone-with-vscode.user.js
filler-highlighter.user.js
jitsi-video-capture.user.js
stream-watchtool.user.js
```

Every release should include all four assets because the `latest` release URL
is shared by all scripts.

To install a script built from the current checkout, run:

```bash
make install SCRIPT=jitsi-video-capture
```

Use any `id` from a script's `script.json`. The command opens the local
userscript URL in your browser and keeps a temporary local server running
until you press Ctrl+C. Add future scripts by creating another per-script
folder and `script.json` rather than changing the Makefile and installer.

Each metadata file is validated by [`scripts/script.schema.json`](scripts/script.schema.json).
Most editors detect the `$schema` entry automatically and provide completion
and validation while editing `script.json`.

Each script keeps its metadata next to its source or project:

```text
Clone-With-Vscode/script.json
Filler-Highlighter/script.json
Jitsi-Video-Capture/script.json
Stream-Watchtool/script.json
```

## Development

### Create a new user script

```bash
pnpm create monkey
```

### Develop a user script

```bash
cd ScriptName
pnpm dev
```