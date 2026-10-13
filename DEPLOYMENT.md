# Deployment: Cloudflare Pages and GitHub Pages

Domain: `shivalaycollection.online`. The code is identical on both hosts. Only hosting settings and DNS change.

## 1. Deploy on Cloudflare Pages

1. Push this folder to a GitHub repo (root contains `index.html`).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
3. Build settings: **Framework preset: None**, **Build command: (empty)**, **Build output directory: `/`** (root; if it rejects `/`, use `.`).
4. **Settings → Environment variables** (Production and Preview), only needed for the WhatsApp preview function:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon / publishable key
   Redeploy after adding them.
5. **Custom domains** → **Set up a custom domain** → `shivalaycollection.online` (and `www` if wanted).
6. DNS:
   - Easiest: move the domain's nameservers to Cloudflare. At your registrar, replace the nameservers with the two Cloudflare gives you. Cloudflare then creates the records for the Pages domain.
   - Without moving nameservers: only possible for subdomains (CNAME `www` → `<project>.pages.dev`). An apex domain needs Cloudflare DNS.
7. Wait for the domain to show **Active** and the certificate to issue (minutes to a few hours).

## 2. Switch back to GitHub Pages

1. Repo → **Settings → Pages** → Source: **Deploy from a branch**, branch `main`, folder `/ (root)` → Save.
2. Under **Custom domain** enter `shivalaycollection.online` → Save. (The `CNAME` file already contains it.)
3. At your DNS provider, set the apex records:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` (optional) → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `www` `CNAME` → `<your-github-username>.github.io`
   - Remove the old Cloudflare Pages records. Check the current IPs in GitHub's docs before you save.
4. If the domain's nameservers are at Cloudflare, either keep Cloudflare as DNS only (set records to **DNS only**, grey cloud, not proxied) or change the nameservers back at the registrar to your old DNS provider.
5. When GitHub's DNS check passes, tick **Enforce HTTPS**.
6. In Cloudflare: **Workers & Pages → project → Custom domains** → remove `shivalaycollection.online` (and later delete the Pages project or the zone if you no longer need it).

## 3. Test checklist (run on BOTH hosts)

- [ ] Home page `/` loads, sarees show, styling and logo are correct.
- [ ] Click a saree: URL becomes `/saree/124`, detail shows, Back returns to the catalog at the same scroll position.
- [ ] Open `/saree/124` directly in a new tab: the detail page shows.
- [ ] Refresh on `/saree/124`: the detail page stays.
- [ ] Old link `/#/saree/124` converts to `/saree/124` and shows the detail.
- [ ] A non-existent path like `/nothing` shows the home catalog (no blank page or loop).
- [ ] `/admin.html` loads, login works, a saree can be edited and image upload works.
- [ ] Share button on a saree shares or copies `https://shivalaycollection.online/saree/124` (no `#`).
- [ ] WhatsApp order button opens WhatsApp with the right number and the clean saree link.
- [ ] `/privacy.html`, `/terms.html` open; Return policy link goes to `/#return-policy` and scrolls to the section.
- [ ] Paste `/saree/124` into WhatsApp: **Cloudflare** shows that saree's title, price and photo; **GitHub** shows the default shop preview (expected). WhatsApp caches previews, so test with a saree ID not shared before.

On Cloudflare, `admin.html` may redirect to `/admin` (Cloudflare strips `.html`). That is normal and still works.

## 4. What changes and what stays the same

| Item | Changes when switching? |
| --- | --- |
| HTML, CSS, JS, `config.js` | Same, no edits |
| Supabase data, login, storage | Same |
| URLs (`/`, `/saree/ID`, old `#/saree/ID`) | Same |
| Direct links to `/saree/ID` | Same result. Mechanism differs: `_redirects` on Cloudflare, `404.html` on GitHub |
| `_redirects`, `functions/` | Used by Cloudflare only, ignored by GitHub |
| `404.html`, `CNAME`, `.nojekyll` | Used by GitHub only, ignored by Cloudflare |
| Per-saree WhatsApp preview | **Lost on GitHub** (default shop preview shown) |
| Environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) | Cloudflare only, for the preview function |
| Hosting settings | Different dashboard (Pages project vs repo Settings → Pages) |
| DNS | Different records (Cloudflare nameservers vs GitHub A/CNAME records) |
| HTTPS certificate | Automatic on both; GitHub needs **Enforce HTTPS** ticked |
| Page load for direct `/saree/ID` | GitHub does one extra redirect through `404.html` and returns a 404 status first |
