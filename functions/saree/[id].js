/**
 * Cloudflare Pages Function: /saree/:id
 * Adds saree-specific Open Graph tags so WhatsApp/Facebook previews show the saree.
 * Optional. GitHub Pages ignores the functions/ folder (default shop preview is shown).
 *
 * Env vars (Cloudflare Pages > Settings > Environment variables):
 *   SUPABASE_URL, SUPABASE_ANON_KEY   (the anon key is public by design)
 */
const SHOP = 'Shivalay Collection';

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const page = () => env.ASSETS.fetch(new URL('/', url)); // index.html

  try {
    const id = String(params.id || '');
    if (!/^\d+$/.test(id) || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return await page();

    const api = `${env.SUPABASE_URL}/rest/v1/sarees?id=eq.${id}&select=name,price,status,fabric,color,images&limit=1`;
    const res = await fetch(api, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Accept: 'application/json' },
    });
    if (!res.ok) return await page();
    const rows = await res.json();
    const s = rows && rows[0];
    if (!s) return await page();

    const sold = s.status === 'Sold';
    const price = Number(s.price).toLocaleString('en-IN');
    const title = `${s.name} - ₹${price}${sold ? ' (Sold out)' : ''} | ${SHOP}`;
    const details = [s.fabric, s.color].filter(Boolean).join(', ');
    const desc = `${s.name}${details ? ` in ${details}` : ''} - ₹${price}. ` +
      (sold ? 'Sold out - ask for similar sarees on WhatsApp.' : 'Order directly on WhatsApp.');
    const canonical = `${url.origin}/saree/${id}`;
    const img = Array.isArray(s.images) ? s.images.find(u => /^https:\/\//.test(u) && !/\.svg(\?|$)/i.test(u)) : null;

    const setContent = value => ({ element: el => el.setAttribute('content', value) });
    const rewriter = new HTMLRewriter()
      .on('title', { element: el => el.setInnerContent(title) })
      .on('meta[name="title"]', setContent(title))
      .on('meta[name="description"]', setContent(desc))
      .on('meta[property="og:title"]', setContent(title))
      .on('meta[property="og:description"]', setContent(desc))
      .on('meta[property="og:url"]', setContent(canonical))
      .on('meta[property="twitter:title"]', setContent(title))
      .on('meta[property="twitter:description"]', setContent(desc))
      .on('meta[property="twitter:url"]', setContent(canonical))
      .on('meta[property="twitter:card"]', setContent('summary_large_image'))
      .on('link[rel="canonical"]', { element: el => el.setAttribute('href', canonical) });

    if (img) {
      rewriter
        .on('meta[property="og:image"]', setContent(img))
        .on('meta[property="og:image:secure_url"]', setContent(img))
        .on('meta[property="twitter:image"]', setContent(img))
        // default banner dimensions/type no longer apply to the saree photo
        .on('meta[property="og:image:width"]', { element: el => el.remove() })
        .on('meta[property="og:image:height"]', { element: el => el.remove() })
        .on('meta[property="og:image:type"]', { element: el => el.remove() });
    }

    const out = rewriter.transform(await page());
    const headers = new Headers(out.headers);
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=300');
    return new Response(out.body, { status: 200, headers });
  } catch (e) {
    return page();
  }
}
