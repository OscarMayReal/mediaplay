# MediaPlay

MediaPlay is a music and video player, with support for syning to MP3 players

Some features are still not implemented, but have buttons in the UI that do nothing

## How to use

When setting up, make sure the libraries are enabled.

To use the media player sync, use disk utility and make sure the device is named {devicename}_MP

You can download podcasts in the podcasts tab. You need to know the RSS URL for the podcast, it does not have the ability to search for podcasts yet. You can then download episodes, and play them from that page, or from the music pages.

You can launch Large Screen Mode from the "more" menu, and clicking Large Screen Mode.

Large Screen Mode is optimised for navigation with a keyboard, although a mouse works as well. 

MediaPlay also now includes a DLNA media server, allowing you to access that media from another device (phone, cocmputer, or some TVs)

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

## Using Large Secreen Mode without a mouse
Large Screen Mode is a feature that allows you to have an experience designed for large screens (such as a TV)

You can usually launch it from the "more" menu at the right of the header. If you cannot open this menu (for example, your device does not have a mouse attached, and you want to autostart Large Screen Mode), you can pass the `--large-screen` argument, and MediaPlay will launch directly into Large Screen Mode