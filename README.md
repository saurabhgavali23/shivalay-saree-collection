# Shivalay Saree Collection

Plain HTML, CSS and vanilla JS. No build step, no framework. Data, login and file storage are all in Supabase.
Runs unchanged on **Cloudflare Pages** or **GitHub Pages**. See [DEPLOYMENT.md](DEPLOYMENT.md) for both host guides, the test checklist and the switch table.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Catalog (`/`) and saree detail (`/saree/ID`). Restores clean URLs before the app loads |
| `app.js` | Catalog logic and History API router (`pushState`, `popstate`, `a[data-link]`) |
| `config.js` | **All settings**: Supabase URL and anon key, WhatsApp number, shop name, texts |
| `parser.js`, `styles.css` | Shared helpers and styles |
| `admin.html`, `admin.js` | Admin panel (`/admin.html`, noindex) |
| `privacy.html`, `terms.html` | Policy pages. Return policy is the `/#return-policy` section of the home page |
| `404.html` | GitHub Pages: redirects unknown paths to `/?p=<path>` |
| `_redirects` | Cloudflare Pages: `/saree/*  /index.html  200` (ignored by GitHub) |
| `functions/saree/[id].js` | Cloudflare only, optional: per-saree WhatsApp preview (ignored by GitHub) |
| `CNAME`, `.nojekyll` | GitHub Pages custom domain and no-Jekyll flag (ignored by Cloudflare) |
| `supabase-setup.sql`, `SETUP-GUIDE.md` | Database setup and feature docs |

## Rules to keep it portable

- Use absolute paths (`/styles.css`, `/app.js`) and `data-link` on in-app links.
- No Cloudflare KV, D1, R2 or Workers bindings in the main site.
- Settings live in `config.js`, never in hosting environment variables (the only exception is the optional preview function).
