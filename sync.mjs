// node sync.mjs <downloaded rsvp-guests.json>   → diff vs guests.json, log changes, encrypt to data.enc, commit + push. Prints a Hebrew summary.
import fs from 'node:fs'; import { execSync } from 'node:child_process'; import { webcrypto as crypto } from 'node:crypto';
const dir = new URL('.', import.meta.url).pathname; process.chdir(dir);
const src = process.argv[2]; if (!src) throw new Error('usage: node sync.mjs <rsvp-guests.json>');
const fresh = JSON.parse(fs.readFileSync(src, 'utf8'));
if (!Array.isArray(fresh) || fresh.length < 50) throw new Error('refusing: file has ' + (fresh.length ?? 'no') + ' guests'); // guard against a broken download wiping the list
const old = fs.existsSync('guests.json') ? JSON.parse(fs.readFileSync('guests.json', 'utf8')) : [];
const log = fs.existsSync('changes.json') ? JSON.parse(fs.readFileSync('changes.json', 'utf8')) : [];
const key = g => g.name + '|' + g.phone, oldBy = new Map(old.map(g => [key(g), g]));
const at = new Date().toISOString(), changes = [];
for (const g of fresh) { const o = oldBy.get(key(g)); if (!o) { if (old.length) changes.push({ at, name: g.name, from: null, to: g.status, coming: g.coming }); }
  else if (o.status !== g.status || o.coming !== g.coming) changes.push({ at, name: g.name, from: o.status, to: g.status, coming: g.coming }); }
log.push(...changes);
fs.writeFileSync('guests.json', JSON.stringify(fresh)); fs.writeFileSync('changes.json', JSON.stringify(log));
if (src !== dir + 'guests.json') fs.unlinkSync(src);
// encrypt {updatedAt, guests, changes} with the passphrase in .secret (PBKDF2 → AES-GCM); the site decrypts in the browser
const pass = fs.readFileSync('.secret', 'utf8').trim(), enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const km = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify({ updatedAt: at, guests: fresh, changes: log.slice(-300) })));
const b64 = u => Buffer.from(u).toString('base64');
fs.writeFileSync('data.enc', JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
const n = s => fresh.filter(g => g.status === s), inv = a => a.reduce((x, g) => x + g.invited, 0), people = n('confirmed').reduce((a, g) => a + g.coming, 0);
const notComing = inv(n('declined')) + inv(n('confirmed')) - people, pendingPeople = inv(n('pending'));
const he = { confirmed: 'אישרו', declined: 'סירבו', pending: 'טרם ענו' };
const lines = changes.map(c => `${c.name}: ${c.from ? he[c.from] + ' ← ' : 'חדש: '}${he[c.to]}${c.to === 'confirmed' ? ` (${c.coming})` : ''}`);
const summary = `מגיעים ${people} אנשים (${n('confirmed').length} הזמנות), לא מגיעים ${notComing}, טרם ענו ${pendingPeople} אנשים (${n('pending').length} הזמנות). שינויים מאז הפעם הקודמת: ${changes.length}${lines.length ? '\n' + lines.join('\n') : ''}`;
if (process.argv.includes('--no-git')) { console.log(summary); process.exit(0); }
execSync('git add data.enc && (git diff --cached --quiet || git commit -qm "rsvp sync ' + at.slice(0, 16) + '") && git push -q', { stdio: 'inherit' });
console.log(summary);
