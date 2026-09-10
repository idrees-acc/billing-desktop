# Billing & GST Invoicing — desktop app

The same application as before, now a real desktop program: its own window and menu bar, the database as a plain file on your disk, native backup and restore dialogs, and one-click PDF filing.

```
main.js            the desktop shell — window, menus, dialogs, PDF, backups
preload.js         the narrow bridge between the page and the shell
storage.js         reading and writing the data file, atomic, with rotating backups
renderer/index.html  the application itself
package.json       dependencies and installer settings
```

## Run it on your own machine

You need [Node.js](https://nodejs.org) (the LTS download) installed once. Then, in a terminal or Command Prompt inside this folder:

```
npm install
npm start
```

The app opens in its own window. That is all it needs — no internet after the install, no account, no server.

## Make installers

On a **Windows** machine:

```
npm run build:win
```

produces `dist/Billing & GST Invoicing Setup 1.0.0.exe` — a normal installer with a Start-menu and desktop shortcut.

On a **Mac**:

```
npm run build:mac
```

produces `dist/Billing & GST Invoicing-1.0.0.dmg`, for both Apple Silicon and Intel.

Each installer must be built on that kind of machine. The builds are unsigned, so the first launch needs a nudge: on Windows choose *More info → Run anyway*, on macOS right-click the app and choose *Open*. Signing needs a paid certificate from Microsoft or Apple, and can be added to `package.json` later.

To use your own icon, drop `icon.ico` (256×256) and `icon.icns` into the `build/` folder before building.

## What the desktop version adds

**Your data is a file.** `Billing Data/billing-data.json`, written the instant anything changes. *File → Show data folder* opens it; *Help → Where is my data?* shows the full path. Copy that folder to a pen drive, an external disk or a Drive folder and the entire business goes with it. Writes are atomic — a temp file is flushed and then renamed over the original — so a crash or a power cut cannot leave a half-written database.

**Backups happen on their own.** One dated copy on the first launch of each day, another every time you close the app, plus *File → Back up now* whenever you want, with an option to save a second copy straight to a pen drive. The last 30 are kept in `Billing Data/Backups`. *File → Restore from backup…* picks one, saves what you have now first, and reloads.

**PDFs file themselves.** Open an invoice, click **Save as PDF**, and it lands at

```
Documents/Billing/Invoices/FY 2026-27/Moving Image Studios Pvt Ltd/INV-2026-27-001.pdf
```

as a single A4 page. Delete the PDF whenever you like; the record stays and prints again identically.

**Menus and shortcuts.** Ctrl/Cmd+N for a new invoice, Ctrl/Cmd+P to file the open one as PDF, Ctrl/Cmd+B to back up. The Go menu jumps to the dashboard, register, outstanding, customers, reports and data screens.

**Excel and CSV** exports now open a real Save dialog and reveal the file when it is written.

## Moving to a new computer

1. *File → Back up now*, then **Save a copy elsewhere…** onto a pen drive.
2. Install the app on the new machine and open it.
3. *File → Restore from backup…* and pick that file.

Customers, services, shows, invoices, payments, TDS, outstanding, numbering and settings all come back exactly as they were.

## A note on the database format

The data is one JSON file rather than SQLite. For a practice billing a few hundred invoices a year, a single atomically-written file is simpler, needs no native modules to compile per platform, and can be opened and read by anything — which is the point of the portability requirement. If the volume ever grows or two people need to work at once, `storage.js` is the only file that has to change: it is the sole place the app touches the disk.

## Security

The window runs with context isolation on and the preload sandboxed; the page has no access to your filesystem beyond reading and writing its own data file through the shell. External links open in your normal browser rather than inside the app. The optional PIN in Settings still applies.
