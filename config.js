/**
 * ==============================================================================
 * SHIVALAY SAREE COLLECTION - CENTRAL CONFIGURATION FILE
 * ==============================================================================
 * Edit this file to add your Supabase credentials, WhatsApp number, shop details,
 * and text sections.
 * ==============================================================================
 */

const CONFIG = {
  // ----------------------------------------------------------------------------
  // 1. SUPABASE BACKEND CREDENTIALS
  // ----------------------------------------------------------------------------
  // Find these in your Supabase Dashboard:
  // Project Settings -> API -> Project URL and Project API Keys (anon / public)
  //
  // NOTE: The 'anon' key is SAFE to be public. It is protected by Row Level Security.
  // NEVER use or expose the 'service_role' secret key here!
  SUPABASE_URL: "https://ixlkxdhifffzzvdckycd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_8J_lk1nUhIZmm4A3o2_UAg_lwjpdPAH",

  // Storage buckets created in Supabase
  STORAGE_BUCKET: "saree-images",
  STORAGE_VIDEO_BUCKET: "saree-videos",

  // Video limits
  MAX_VIDEO_SIZE_MB: 15,
  MAX_VIDEO_DURATION_SEC: 15,

  // ----------------------------------------------------------------------------
  // 2. SHOP BRANDING & CONTACT
  // ----------------------------------------------------------------------------
  SHOP_NAME: "Shivalay Saree Collection",
  SHOP_TAGLINE: "Pure Elegance in Every Weave • 100% Online Saree Boutique",
  SITE_URL: "https://shivalaycollection.online",
  LOGO_URL: "shivalay-monogram-logo.svg",
  ICON_URL: "shivalay-monogram-icon.svg",

  // WhatsApp number in international format without '+' or spaces.
  // Format for India: 91 followed by 10-digit phone number -> "919876543210"
  WHATSAPP_NUMBER: "917385121060",

  // Currency symbol
  CURRENCY_SYMBOL: "₹",

  // Shipping charges configuration
  SHIPPING: {
    DEFAULT_CHARGE: 0, // 0 = Free Delivery by default, or set a flat amount e.g. 100
    FREE_LABEL: "Free Delivery",
    POLICY_TEXT: "Pan-India Insured Shipping"
  },

  // Default Margin for Admin Auto-Fill (Cost Price -> Selling Price)
  DEFAULT_MARGIN: {
    TYPE: "flat", // "flat" (₹) or "percent" (%)
    VALUE: 300    // e.g. 300 flat or 25%
  },

  // How long to cache catalog data in sessionStorage (in minutes)
  CACHE_TTL_MINUTES: 5,

  // ----------------------------------------------------------------------------
  // 3. ADMIN DROPDOWN SUGGESTIONS (For quick entry in admin form)
  // ----------------------------------------------------------------------------
  CATEGORY_SUGGESTIONS: [
    "Bridal",
    "Festive",
    "Party Wear",
    "Handloom",
    "Casual",
    "Traditional",
    "Contemporary"
  ],

  FABRIC_SUGGESTIONS: [
    "Pure Silk",
    "Banarasi Silk",
    "Kanjivaram Silk",
    "Chanderi Silk",
    "Tussar Silk",
    "Organza Silk",
    "Pure Georgette",
    "Pure Chiffon",
    "Tissue Silk",
    "Linen Silk",
    "Cotton Silk"
  ],

  // ----------------------------------------------------------------------------
  // 4. ABOUT US SECTION
  // ----------------------------------------------------------------------------
  ABOUT: {
    TITLE: "About Shivalay Saree Collection",
    SUBTITLE: "100% Online Saree Boutique • Direct from Master Weavers to Your Doorstep",
    DESCRIPTION_P1: "Welcome to Shivalay Saree Collection, your trusted online destination for authentic Indian handlooms, regal bridal silks, and contemporary festive wear. We sell exclusively online with no physical retail shops or middleman overheads.",
    DESCRIPTION_P2: "By operating purely online, we keep our prices direct and transparent, passing maximum savings to you without showroom markups. We also offer personal WhatsApp video consultations so you can experience the exact color, zari luster, and drape before placing your order.",
    HIGHLIGHTS: [
      { icon: "🌐", title: "100% Online Boutique", desc: "No physical store overheads — authentic direct-weaver pricing" },
      { icon: "✨", title: "100% Authentic Handloom", desc: "Certified pure silk & genuine zari craftsmanship" },
      { icon: "📦", title: "Pan-India Safe Delivery", desc: "Insured doorstep delivery with real-time tracking" },
      { icon: "📹", title: "Live Video Verification", desc: "Inspect real drape, color & texture on WhatsApp video call" }
    ]
  },

  // ----------------------------------------------------------------------------
  // 5. HOW ORDERING WORKS (3 SIMPLE STEPS)
  // ----------------------------------------------------------------------------
  HOW_TO_ORDER: {
    TITLE: "How to Order Online in 3 Simple Steps",
    SUBTITLE: "Shop from anywhere in India — 100% online with personal WhatsApp assistance",
    STEPS: [
      {
        step: "1",
        title: "Browse & Select",
        desc: "Explore our online catalog and find your dream saree. Watch the drape video and click 'Order on WhatsApp' on the saree details page.",
        icon: "📱"
      },
      {
        step: "2",
        title: "WhatsApp Us",
        desc: "A pre-filled message with the saree ID, name, price, and link opens automatically. Ask questions, request more photos, or ask for a live video verification.",
        icon: "💬"
      },
      {
        step: "3",
        title: "Pay by QR & Relax",
        desc: "Confirm your order, pay securely via UPI QR code, and we dispatch your saree.",
        icon: "🛍️"
      }
    ]
  },

  // ----------------------------------------------------------------------------
  // 6. RETURN POLICY
  // ----------------------------------------------------------------------------
  RETURN_POLICY: {
    TITLE: "Return Policy",
    SUBTITLE: "No Exchange • Return accepted strictly for damaged items with mandatory unboxing video",
    POINTS: [
      "No Exchange Policy: We do not offer any exchanges or replacements. Please review all saree details, photos, and drape videos carefully before confirming your order.",
      "Return Only if Damage Found: Returns are accepted strictly in the rare case that a physical defect or damage is found upon arrival.",
      "Full Unpacking Video Mandatory: A single continuous, uncut, full unboxing/unpacking video (showing the sealed outer package, label, opening, and full inspection of the saree) is strictly required as proof. Claims without a complete unboxing video cannot be accepted.",
      "Customer Self-Ship Return: If damage is verified, the customer must courier / resend the saree by themselves to our provided return address.",
      "Condition: The saree must be unworn, unwashed, in its original folding, with all tags intact and the unstitched blouse piece attached."
    ]
  },

  // ----------------------------------------------------------------------------
  // 7. FOOTER & CONTACT DETAILS
  // ----------------------------------------------------------------------------
  FOOTER: {
    ADDRESS: "100% Online Store • Pan-India Courier Delivery",
    PHONE: "+91 81496 77704",
    HOURS: "Online Support: Monday to Saturday: 10:00 AM – 8:30 PM (IST)",
    COPYRIGHT: "© 2026 Shivalay Saree Collection. All rights reserved."
  },

  // ----------------------------------------------------------------------------
  // 8. DEMO / FALLBACK DATA
  // ----------------------------------------------------------------------------
  // Displayed automatically if SUPABASE_URL still has 'YOUR_PROJECT_ID' so you can
  // test the site immediately before connecting your Supabase project.
  FALLBACK_DATA: [
    {
      id: 101,
      name: "Kanjivaram Pure Silk Saree with Gold Zari Pallu",
      fabric: "Pure Silk",
      color: "Crimson Red",
      available_colors: ["Crimson Red", "Royal Blue", "Rani Pink"],
      pattern: "Floral Jaal",
      border: "Contrast Temple Border",
      category: "Bridal",
      occasion: "Wedding / Reception",
      description: "Magnificent heirloom Kanjivaram silk saree woven with 2g pure gold zari. Features intricate peacock and chakra motifs along the traditional korvai border. Paired with a running unstitched blouse piece.",
      price: 14500,
      shipping_charges: 0,
      images: [
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1000&q=80"
      ],
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      video_poster: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80",
      status: "Available",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      reviews: [
        {
          id: 1,
          customer_name: "Pooja Sharma (Pune)",
          rating: 5,
          comment: "The pure zari work on the pallu is breathtaking! Wore it for my cousin's wedding reception and received countless compliments. Exactly as shown in the live drape video.",
          photos: [
            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80"
          ],
          video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          created_at: new Date(Date.now() - 4 * 86400000).toISOString()
        },
        {
          id: 2,
          customer_name: "Dr. Ananya Sen (Kolkata)",
          rating: 5,
          comment: "Authentic Kanjivaram silk weight and fall! Shipping was fast and the unboxing packaging was very premium.",
          photos: [
            "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80"
          ],
          video_url: null,
          created_at: new Date(Date.now() - 8 * 86400000).toISOString()
        }
      ]
    },
    {
      id: 102,
      name: "Banarasi Katan Silk Saree in Emerald Green",
      fabric: "Banarasi Silk",
      color: "Emerald Green",
      available_colors: ["Emerald Green", "Wine Burgundy", "Rama Green", "Mustard Yellow"],
      pattern: "Kadwa Buti",
      border: "Rich Meenakari Zari Border",
      category: "Festive",
      occasion: "Festivals / Sangeet",
      description: "Handcrafted Banarasi katan silk saree featuring delicate floral kadwa butas across the body and an opulent meenakari zari border. Comes with matching brocade blouse piece.",
      price: 8900,
      shipping_charges: 0,
      images: [
        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80"
      ],
      video_url: null,
      video_poster: null,
      status: "Available",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      reviews: [
        {
          id: 3,
          customer_name: "Sneha Kulkarni (Mumbai)",
          rating: 5,
          comment: "The emerald green shade is so rich and regal. The Meenakari border detailing is super crisp and clean. 100% recommended!",
          photos: [
            "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80"
          ],
          video_url: null,
          created_at: new Date(Date.now() - 6 * 86400000).toISOString()
        }
      ]
    },
    {
      id: 103,
      name: "Pastel Pink Chanderi Silk Saree with Zari Motifs",
      fabric: "Chanderi Silk",
      color: "Pastel Pink",
      pattern: "Ashrafi Buti",
      border: "Delicate Golden Zari Border",
      category: "Party Wear",
      occasion: "Day Weddings / Engagement",
      description: "Lightweight and airy Chanderi silk saree with a sheer texture and glistening gold zari coin butis. Ideal for modern celebrations and day festivities.",
      price: 4950,
      shipping_charges: 0,
      images: [
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1000&q=80"
      ],
      video_url: null,
      video_poster: null,
      status: "Available",
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      reviews: []
    },
    {
      id: 104,
      name: "Royal Navy Blue Tussar Silk Handloom Saree",
      fabric: "Tussar Silk",
      color: "Navy Blue",
      pattern: "Handpainted Madhubani",
      border: "Broad Woven Border",
      category: "Handloom",
      occasion: "Pooja / Traditional Gatherings",
      description: "Rich textured wild Tussar silk saree adorned with artisanal Madhubani folk motifs painted with natural dyes. Authentic handloom with Silk Mark guarantee.",
      price: 6750,
      shipping_charges: 0,
      images: [
        "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1000&q=80"
      ],
      video_url: null,
      video_poster: null,
      status: "Sold",
      created_at: new Date(Date.now() - 18 * 86400000).toISOString()
    },
    {
      id: 105,
      name: "Sunset Mustard Organza Silk Floral Embroidered Saree",
      fabric: "Organza Silk",
      color: "Mustard Yellow",
      pattern: "Floral Resham Embroidery",
      border: "Scalloped Cutwork Border",
      category: "Festive",
      occasion: "Haldi / Mehendi",
      description: "Dreamy sheer organza silk drape with subtle sheen, delicate pastel threadwork flowers, and a designer scalloped cutwork border. Feather-light and stylish.",
      price: 5200,
      shipping_charges: 0,
      images: [
        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1000&q=80"
      ],
      video_url: null,
      video_poster: null,
      status: "Available",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString()
    },
    {
      id: 106,
      name: "Deep Wine Georgette Saree with Micro Sequins",
      fabric: "Pure Georgette",
      color: "Wine Burgundy",
      pattern: "All-Over Micro Sequins",
      border: "Velvet Zari Piping",
      category: "Party Wear",
      occasion: "Cocktail / Evening Reception",
      description: "Fluid pure georgette drape in dramatic wine shade, elevated with tone-on-tone twinkling micro-sequins. Flows gracefully and hugs your silhouette effortlessly.",
      price: 7400,
      shipping_charges: 0,
      images: [
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80"
      ],
      video_url: null,
      video_poster: null,
      status: "Available",
      created_at: new Date(Date.now() - 25 * 86400000).toISOString()
    }
  ]
};

// Expose on global window object
window.CONFIG = CONFIG;
