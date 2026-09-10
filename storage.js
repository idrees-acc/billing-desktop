'use strict';
const fs = require('fs');
const path = require('path');

function pad(x) { return String(x).padStart(2, '0'); }
function stamp(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    '_' + pad(d.getHours()) + '-' + pad(d.getMinutes());
}

/**
 * All application data lives in one folder:
 *   <baseDir>/Billing Data/billing-data.json     <- the live database
 *   <baseDir>/Billing Data/Backups/*.json        <- rotating automatic backups
 * Writes are atomic: a temp file is written and flushed, then renamed over the
 * live file, so a crash or power cut can never leave a half-written database.
 */
function makeStore(baseDir, keep) {
  const dir = path.join(baseDir, 'Billing Data');
  const backupsDir = path.join(dir, 'Backups');
  const file = path.join(dir, 'billing-data.json');
  const marker = path.join(dir, '.last-backup');
  const KEEP = keep || 30;

  fs.mkdirSync(backupsDir, { recursive: true });

  function read() {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return '';
      throw e;
    }
  }

  function write(text) {
    const tmp = file + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, text, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    return true;
  }

  function backup(tag) {
    const text = read();
    if (!text) return null;
    const name = 'Billing_Backup_' + stamp() + (tag ? '_' + tag : '') + '.json';
    const dest = path.join(backupsDir, name);
    fs.writeFileSync(dest, text, 'utf8');
    prune();
    return dest;
  }

  function list() {
    return fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const p = path.join(backupsDir, f);
        const s = fs.statSync(p);
        return { name: f, path: p, size: s.size, time: s.mtime.toISOString() };
      });
  }

  function prune() {
    const all = list();
    all.slice(KEEP).forEach(b => { try { fs.unlinkSync(b.path); } catch (e) {} });
    return all.length;
  }

  /** Copy an outside file in as the live database, after saving what is there now. */
  function restoreFrom(srcPath) {
    const text = fs.readFileSync(srcPath, 'utf8');
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.invoices)) throw new Error('Not a billing backup file');
    backup('before-restore');
    write(text);
    return parsed.invoices.length;
  }

  /** Once a day, on first launch of the day, keep a dated copy. */
  function dailyBackup() {
    const day = new Date().toISOString().slice(0, 10);
    let last = '';
    try { last = fs.readFileSync(marker, 'utf8').trim(); } catch (e) {}
    if (last === day) return null;
    const made = backup('daily');
    fs.writeFileSync(marker, day, 'utf8');
    return made;
  }

  return { dir, backupsDir, file, read, write, backup, list, prune, restoreFrom, dailyBackup, stamp };
}

module.exports = { makeStore, stamp };
