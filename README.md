# Next.js template

This is a Next.js template with shadcn/ui.

## Desktop app

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

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
