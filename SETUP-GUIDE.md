# Shivalay Saree Collection - Online Saree Catalog & Admin Portal (With Video Support)

A mobile-first, high-performance online saree catalog website with a built-in admin panel, backed by **Supabase (free tier)**. Built using pure **HTML, CSS, and vanilla JavaScript** with **zero build tools, zero npm dependencies**, and 100% free hosting on **GitHub Pages**.

---

## 🌟 Key Features

### 🛍️ Public Catalog (`index.html`)
- **Video Drape Previews**:
  - Saree cards display a sleek `▶ Video` badge when a video exists.
  - Saree detail page includes the video as the **first slide** in the gallery with a poster image and big play button.
  - Native uploaded videos (`.mp4`, `.webm`) pause automatically when the user swipes away to another slide.
  - YouTube videos only load their `<iframe>` when tapped (zero initial bandwidth impact).
  - Never autoplays with sound; fast and smooth on entry-level Android devices.
- **Supabase Realtime Database**: Reads directly from the `sarees` PostgreSQL table with instant updates.
- **Clean URL Routing (`/` & `/saree/:id`)**: History API routing; works on GitHub Pages (via `404.html`) and Cloudflare Pages (via `_redirects`). Old `#/saree/ID` links are converted automatically. Preserves catalog scroll position and filter state when returning.
- **Mobile-First Responsive Layout**: 2 columns on mobile, 3–4 columns on desktop.
- **Swipeable Image Gallery**: CSS scroll-snap with synchronized thumbnails and a tap-to-zoom lightbox modal for fine weave inspection.
- **Dynamic Catalog Filters**: Category, fabric, and color filters populated automatically from database records.
- **Price Range Slider & "Hide Sold" Toggle**: Interactive price filtering with live amount updates.
- **Instant Search & Multi-Criteria Sort**: Search across name, fabric, and description; sort by Newest, Price Low to High, or Price High to Low.
- **Direct WhatsApp Ordering**:
  - Automatically encodes a detailed message (`wa.me/<number>?text=...`) containing Saree ID, Name, Price, and Page URL.
  - If sold out, the order button is disabled and an "Ask for similar sarees on WhatsApp" link is shown.
- **Web Share API**: Native mobile sharing sheet with instant copy-link fallback and toast notifications.

### 🔐 Admin Portal (`admin.html`)
- **SEO Protection**: Includes `<meta name="robots" content="noindex, nofollow">` to prevent search engine indexing.
- **Supabase Authentication**: Secure email and password login with session persistence across browser refreshes.
- **Video Drape Upload & YouTube Link**:
  - **Upload Video**: Records from camera or picks from gallery. Validates duration (**max 60 seconds**) and size (**max 15 MB**) client-side. Automatically extracts the first frame on HTML5 Canvas to generate a high-quality JPEG poster!
  - **Paste Video Link**: Accepts YouTube links (`youtube.com` or `youtu.be`) or direct `.mp4` URLs.
  - Video preview with instant removal. Deleting a saree also removes its video and poster files from Supabase Storage.
- **Client-Side Image Compression**: Automatically resizes large camera photos to max 1200px (JPEG quality ~0.8) using Canvas before uploading.
- **Photo Reordering & Cover Badge**: Reorder thumbnails with `←` and `→` buttons. The first photo automatically becomes the main cover image.
- **Full Inventory Management**:
  - Add and Edit sarees with fabric and category suggestions.
  - 1-click **Duplicate** button to clone details for adding similar sarees quickly.
  - 1-click **Mark Sold / Available** toggle button.
  - **Delete** button with confirmation prompt, which also permanently deletes associated images and videos from Supabase Storage.
  - Live search and filter in the admin inventory list.
- **🧹 Storage Cleanup (Orphan Files)**:
  - Scans storage buckets (`saree-images` and `saree-videos`) and compares stored files against all referenced photos, posters, and drape videos across the `sarees` table.
  - Summarizes storage metrics: total files, active files, unreferenced orphan count, and reclaimable space (in KB/MB).
  - Offers preview thumbnails, single-file delete, bulk **Delete Selected**, and 1-click **Delete All Orphans** with explicit confirmation prompts to safely free up Supabase Storage.

---

## 📂 Project Structure

```text
shivalay-saree-collection/
├── index.html            # Public catalog & saree detail page
├── admin.html            # Admin management portal (noindex protected)
├── styles.css            # Unified mobile-first stylesheet & CSS variables
├── config.js             # Supabase project URL, Anon Key, WhatsApp, & shop text
├── app.js                # Public catalog logic (Supabase queries, routing, video player)
├── admin.js              # Admin portal logic (Auth, Canvas compression, video extraction, CRUD)
└── supabase-setup.sql    # Complete SQL script for tables, video columns, RLS, and storage
```

---

## 🛠️ Step-by-Step Supabase Setup

### 1. Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, choose your organization, project name (e.g., `shivalay-saree-collection`), and set a database password.
3. Select a region close to your customers (e.g. `Mumbai / India`) and click **Create new project**.

### 2. Run the SQL Setup Script
1. In the left sidebar of your Supabase dashboard, click the **SQL Editor** (`>_` icon).
2. Click **New query** (or the **+** button).
3. Copy the entire contents of [`supabase-setup.sql`](supabase-setup.sql) and paste them into the SQL Editor.
4. Click the green **Run** button.

This creates the `sarees` table (with image and video columns), performance indexes, security rules (RLS), both storage buckets (`saree-images` and `saree-videos`), and initial sample sarees.

### 3. Create Admin User & Disable Public Signups
1. In the left sidebar, click **Authentication** (the user icon).
2. Under **Users**, click **Add user > Create user**.
3. Enter your email (e.g. `admin@shivalaycollection.online`) and choose a strong password. Click **Create user**.
4. In the left sidebar under Authentication, click **Sign In / Up** (or **Providers**).
5. Under **User Signups**, switch **"Allow new users to sign up"** to **OFF** and save.

### 4. Copy API Credentials into `config.js`
1. Go to **Project Settings > API**.
2. Copy your **Project URL** and the **`anon` / public Key**.
3. Open [`config.js`](config.js) and paste them:

```javascript
const CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your-actual-anon-key-here",
  STORAGE_BUCKET: "saree-images",
  STORAGE_VIDEO_BUCKET: "saree-videos",
  // ...
};
```

---

## 📊 Free-Tier Storage & Bandwidth Limits Explained

Supabase's generous free tier includes:

| Resource | Free Tier Quota | Saree Catalog Usage Guide |
| :--- | :--- | :--- |
| **Database Storage** | **500 MB** | Can hold tens of thousands of saree text records (metadata takes only ~1 KB per saree). |
| **File Storage** | **1 GB (1,000 MB)** | Photos are compressed to ~150–250 KB each (~4,000 photos). A 15-second 720p drape video is typically ~4–6 MB (~150–200 videos). |
| **Monthly Egress Bandwidth** | **5 GB** | Sufficient for thousands of catalog visits per month. Cached in `sessionStorage` to avoid redundant calls. |

### 💡 Pro-Tips for Maximizing Free Storage:
1. **Short 15-second drape videos**: 15 seconds is the sweet spot for showing a saree's sheen, pallu fall, and border movement without ballooning storage.
2. **YouTube Embedding**: Pasting YouTube links takes **0 MB of your Supabase storage** and **0 MB of your Supabase bandwidth**!
3. **Automatic Cleanup**: When you delete a saree in `admin.html`, the code automatically removes the uploaded photos, video, and poster from your Supabase Storage bucket.

### 📈 How to Monitor Your Usage:
1. Open your **Supabase Dashboard**.
2. In the left sidebar, click **Settings (gear icon) > Usage**.
3. Review your **Database Size**, **Storage Size**, and **Egress Bandwidth** in real time.

---

## 💻 How to Test Locally

### Option A: VS Code Live Server (Recommended)
1. Open this folder in **VS Code**.
2. Install the **Live Server** extension.
3. Right-click [`index.html`](index.html) and select **Open with Live Server**.
4. To test the admin panel, navigate to `http://127.0.0.1:5500/admin.html`.

### Option B: Python HTTP Server (Terminal)
In your terminal, run:
```bash
python3 -m http.server 3000
```
(Direct links like `/saree/124` will 404 on this simple server; open `/` and click through, or use `/?p=%2Fsaree%2F124`.)
Open `http://localhost:3000` for the store, or `http://localhost:3000/admin.html` for the admin portal.

---

## 🌐 Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for Cloudflare Pages and GitHub Pages steps.

---

## ⚙️ How to Change WhatsApp Number, Shop Name, and Texts

Open [`config.js`](config.js). Customize:
```javascript
const CONFIG = {
  SHOP_NAME: "Shivalay Saree Collection",
  SHOP_TAGLINE: "Pure Elegance in Every Weave • Premium Silk, Banarasi & Handloom Sarees",
  
  // Format: 91 followed by 10-digit number (NO '+' or spaces)
  WHATSAPP_NUMBER: "919876543210",
  CURRENCY_SYMBOL: "₹",

  // Sections
  ABOUT: { ... },
  HOW_TO_ORDER: { ... },
  RETURN_POLICY: { ... },
  FOOTER: { ... }
};
```
