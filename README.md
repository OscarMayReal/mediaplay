# MediaPlay

MediaPlay is a music and video player, with support for syning to MP3 players

some features are still not implemented, but have buttons in the UI that do nothing

## How to use

when setting up, make sure the libraries are enabled.

to use the media player sync, use disk utility and make sure the device is named {devicename}_MP

## Desktop app (for running dev)

Start the Electron app with live Next.js development:

```bash
bun run desktop:dev
```

Build and run the production desktop app locally:

```bash
bun run desktop:preview
```

Create a desktop installer for your current operating system in `dist-electron/`:

```bash
bun run desktop:package
```

The packaged app runs the Next.js standalone server on a local port. Build installers on the operating system they target. Distributable installers may need code signing for normal installation on macOS and Windows.

### macOS: "Mediaplay is damaged and can't be opened"

If you downloaded the prebuilt macOS `.dmg` from the project's GitHub Releases and macOS says the app is damaged, first open the DMG and drag `Mediaplay.app` into Applications. Only do this for a release you trust. Then open Terminal and run:

```bash
xattr -cr /Applications/Mediaplay.app
```

Then open Mediaplay again. If macOS shows a standard security warning instead, Control-click the app in Applications, choose **Open**, and confirm **Open** in the dialog.
