# wedding-rsvp

Guest RSVP dashboard for Maya & Eshed (16.10.2026). The page decrypts `data.enc` in the browser with a passphrase; no guest data is stored in plain text here.

- `index.html` - the dashboard (GitHub Pages)
- `data.enc` - AES-GCM encrypted `{updatedAt, guests, changes}`
- `scrape.js` - runs inside the iplan RSVP tab and prints the guest JSON into the page (read it back with get_page_text, save as `incoming.json`)
- `sync.mjs` - `node sync.mjs incoming.json` diffs, logs changes, re-encrypts, commits and pushes
