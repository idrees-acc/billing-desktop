'use strict';
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { makeStore } = require('./storage');

let store = null;
let win = null;

const PRODUCT = 'Billing & GST Invoicing';

function invoiceFolder() {
  return path.join(app.getPath('documents'), 'Billing', 'Invoices');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    title: PRODUCT,
    backgroundColor: '#F5F6F9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // External links open in the real browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function menuSend(channel) {
  return () => { if (win) win.webContents.send('menu', channel); };
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [];

  if (mac) {
    template.push({
      label: app.name,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' },
        { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }]
    });
  }

  template.push({
    label: 'File',
    submenu: [
      { label: 'New invoice', accelerator: 'CmdOrCtrl+N', click: menuSend('new-invoice') },
      { label: 'Save invoice as PDF', accelerator: 'CmdOrCtrl+P', click: menuSend('save-pdf') },
      { type: 'separator' },
      { label: 'Back up now', accelerator: 'CmdOrCtrl+B', click: () => backupNow() },
      { label: 'Restore from backup…', click: () => restorePick() },
      { label: 'Export Excel workbook', click: menuSend('excel') },
      { type: 'separator' },
      { label: 'Show data folder', click: () => shell.openPath(store.dir) },
      { label: 'Show invoice folder', click: () => { fs.mkdirSync(invoiceFolder(), { recursive: true }); shell.openPath(invoiceFolder()); } },
      { type: 'separator' },
      mac ? { role: 'close' } : { role: 'quit' }
    ]
  });

  template.push({
    label: 'Edit',
    submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }]
  });

  template.push({
    label: 'Go',
    submenu: [
      { label: 'Dashboard', click: menuSend('go:dashboard') },
      { label: 'Invoice register', click: menuSend('go:invoices') },
      { label: 'Outstanding', click: menuSend('go:outstanding') },
      { label: 'Customers', click: menuSend('go:customers') },
      { label: 'Reports', click: menuSend('go:party') },
      { label: 'Data, backup and export', click: menuSend('go:data') },
      { type: 'separator' },
      { role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'toggleDevTools' }
    ]
  });

  template.push({
    label: 'Help',
    submenu: [
      { label: 'Where is my data?', click: () => {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Where your data lives',
          message: 'Your database is a single file on this computer.',
          detail: store.file + '\n\nAutomatic backups: ' + store.backupsDir +
            '\n\nCopy either of these anywhere — a pen drive, an external disk, a Drive folder — ' +
            'and the whole business comes with it. Nothing is stored online.',
          buttons: ['Show me the folder', 'Close'],
          defaultId: 0
        }).then(r => { if (r.response === 0) shell.openPath(store.dir); });
      } },
      { label: 'Backups kept here', click: () => shell.openPath(store.backupsDir) }
    ]
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function backupNow(silent) {
  const made = store.backup();
  if (silent) return made;
  if (!made) {
    dialog.showMessageBox(win, { type: 'info', message: 'Nothing to back up yet.' });
    return null;
  }
  const r = await dialog.showMessageBox(win, {
    type: 'info',
    message: 'Backup saved.',
    detail: made + '\n\nKeep a copy off this computer too — a pen drive, an external disk, or a synced Drive folder.',
    buttons: ['Save a copy elsewhere…', 'Show folder', 'Done'],
    defaultId: 0
  });
  if (r.response === 0) {
    const out = await dialog.showSaveDialog(win, { defaultPath: path.basename(made) });
    if (!out.canceled) fs.copyFileSync(made, out.filePath);
  } else if (r.response === 1) shell.openPath(store.backupsDir);
  return made;
}

async function restorePick() {
  const pick = await dialog.showOpenDialog(win, {
    title: 'Choose a backup file',
    defaultPath: store.backupsDir,
    filters: [{ name: 'Billing backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (pick.canceled) return;
  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'Replace everything with this backup?',
    detail: 'A copy of your current data is saved first, so this can be undone.\n\n' + pick.filePaths[0],
    buttons: ['Restore', 'Cancel'],
    defaultId: 1,
    cancelId: 1
  });
  if (confirm.response !== 0) return;
  try {
    const count = store.restoreFrom(pick.filePaths[0]);
    win.reload();
    setTimeout(() => dialog.showMessageBox(win, {
      type: 'info', message: 'Restored.', detail: count + ' invoices are back.'
    }), 600);
  } catch (e) {
    dialog.showErrorBox('That file could not be restored', e.message);
  }
}

/* ---------- renderer bridge ---------- */
ipcMain.on('data-read', e => {
  try { e.returnValue = store.read(); }
  catch (err) { e.returnValue = ''; dialog.showErrorBox('The data file could not be read', err.message); }
});

ipcMain.on('data-write', (e, text) => {
  try { store.write(text); e.returnValue = true; }
  catch (err) { e.returnValue = false; dialog.showErrorBox('The data file could not be saved', err.message); }
});

ipcMain.handle('backup-list', () => store.list());

ipcMain.handle('backup-now', () => backupNow());
ipcMain.handle('restore-pick', () => restorePick());
ipcMain.handle('open-data-folder', () => shell.openPath(store.dir));
ipcMain.handle('open-invoice-folder', () => {
  fs.mkdirSync(invoiceFolder(), { recursive: true });
  return shell.openPath(invoiceFolder());
});
ipcMain.handle('paths', () => ({ data: store.file, backups: store.backupsDir, invoices: invoiceFolder() }));

/** Save a file the renderer built (Excel workbook, CSV, JSON backup). */
ipcMain.handle('save-file', async (e, { name, text }) => {
  const out = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), name) });
  if (out.canceled) return null;
  fs.writeFileSync(out.filePath, text, 'utf8');
  shell.showItemInFolder(out.filePath);
  return out.filePath;
});

/**
 * Print the open invoice to PDF and file it as
 * Documents/Billing/Invoices/FY 2026-27/Customer Name/INV-2026-27-001.pdf
 */
ipcMain.handle('save-pdf', async (e, { fy, customer, no }) => {
  const safe = s => String(s || '').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'Unnamed';
  const dir = path.join(invoiceFolder(), 'FY ' + safe(fy), safe(customer));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, safe(no).replace(/[\/]/g, '-') + '.pdf');
  const data = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { marginType: 'none' }
  });
  fs.writeFileSync(file, data);
  const r = await dialog.showMessageBox(win, {
    type: 'info',
    message: 'Invoice saved as PDF.',
    detail: file,
    buttons: ['Open it', 'Show folder', 'Done'],
    defaultId: 2
  });
  if (r.response === 0) shell.openPath(file);
  if (r.response === 1) shell.showItemInFolder(file);
  return file;
});

/* ---------- lifecycle ---------- */
const single = app.requestSingleInstanceLock();
if (!single) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(() => {
    store = makeStore(app.getPath('userData'));
    store.dailyBackup();
    buildMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('before-quit', () => { try { store.backup('on-close'); } catch (e) {} });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
