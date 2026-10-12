/**
 * LN Jewellers — database seed script.
 * Run: bun run scripts/seed.ts
 * Idempotent: skips seeding when products already exist (use --force to reseed).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const force = process.argv.includes("--force");

async function main() {
  const existing = await db.product.count();
  if (existing > 0 && !force) {
    console.log(`Database already has ${existing} products — skipping seed (use --force to reseed).`);
    return;
  }

  if (force) {
    await db.inventoryMovement.deleteMany();
    await db.orderItem.deleteMany();
    await db.payment.deleteMany();
    await db.order.deleteMany();
    await db.review.deleteMany();
    await db.productVariant.deleteMany();
    await db.product.deleteMany();
    await db.collection.deleteMany();
    await db.category.deleteMany();
    await db.contactInquiry.deleteMany();
    await db.newsletterSubscriber.deleteMany();
    await db.auditLog.deleteMany();
    console.log("Cleared existing data.");
  }

  // ---------- Admin user ----------
  const adminEmail = process.env.ADMIN_EMAIL || "admin@lnjewellers.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "LN@Admin1";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "LN Jewellers Admin", passwordHash, role: "ADMIN" },
    update: { passwordHash, role: "ADMIN" },
  });
  await db.user.upsert({
    where: { email: "customer@example.com" },
    create: { email: "customer@example.com", name: "Sample Customer", passwordHash: await bcrypt.hash("Customer@1", 10), role: "CUSTOMER" },
    update: {},
  });
  console.log(`✓ Admin ready: ${adminEmail}`);

  // ---------- Categories ----------
  const catRings = await db.category.create({ data: { slug: "rings", name: "Rings", tagline: "Solitaires, bands & statement cocktail rings", image: "/images/products/ring-solitaire.png", order: 1 } });
  const catNecklaces = await db.category.create({ data: { slug: "necklaces", name: "Necklaces", tagline: "Pendants, chokers & bridal layering sets", image: "/images/products/necklace-choker.png", order: 2 } });
  const catEarrings = await db.category.create({ data: { slug: "earrings", name: "Earrings", tagline: "Studs, jhumkas & sculptural hoops", image: "/images/products/earrings-jhumka.png", order: 3 } });
  const catBracelets = await db.category.create({ data: { slug: "bracelets-bangles", name: "Bracelets & Bangles", tagline: "Handcrafted wrist candy in pure gold", image: "/images/products/bangle-classic.png", order: 4 } });
  console.log("✓ Categories");

  // ---------- Collections ----------
  const colHeritage = await db.collection.create({
    data: {
      slug: "royal-heritage",
      name: "Royal Heritage",
      story: "Inspired by the treasured vaults of Rajputana and the temple jewellery of the South — Regal silhouettes, hand-engraved by master karigars over weeks of quiet devotion.",
      image: "/images/products/necklace-choker.png",
      featured: true,
    },
  });
  const colMinimal = await db.collection.create({
    data: {
      slug: "minimal-muse",
      name: "Minimal Muse",
      story: "Whisper-light gold for every day. Clean lines, mirror finishes and quiet confidence — designed to be layered, lived in and loved for decades.",
      image: "/images/products/ring-minimal.png",
      featured: true,
    },
  });
  const colBridal = await db.collection.create({
    data: {
      slug: "bridal-atelier",
      name: "Bridal Atelier",
      story: "Once-in-a-lifetime pieces for once-in-a-lifetime days. Made-to-order couture jewellery, individually blessed, weighted and hallmarked for your big day.",
      image: "/images/products/necklace-bridal.png",
      featured: true,
    },
  });
  const colArtisan = await db.collection.create({
    data: {
      slug: "artisan-soul",
      name: "Artisan Soul",
      story: "One-of-one handmade treasures — hammered, chased and textured entirely by hand. No two pieces are ever alike, just like the people who wear them.",
      image: "/images/products/pendant-handmade.png",
      featured: true,
    },
  });
  console.log("✓ Collections");

  // ---------- Products ----------
  const care = "Wipe gently with the soft cloth provided after each wear. Store in the lined box away from perfume and moisture. Professional cleaning recommended annually.";

  type SeedProduct = {
    sku: string; slug: string; name: string; short: string; desc: string; price: number; discount?: number;
    categoryId: string; collectionId: string; images: string[]; material: string; purity: string; weight: number;
    dimensions: string; stock: number; threshold?: number; featured?: boolean; best?: boolean; trending?: boolean;
    handmade?: boolean; ready?: boolean; craft?: string; tags: string[]; variants?: { name: string; size?: string; delta: number; stock: number }[];
  };

  const P: SeedProduct[] = [
    {
      sku: "LN-RNG-001", slug: "surya-solitaire-ring", name: "Surya Solitaire Ring",
      short: "A radiant 0.5ct diamond cradled in hand-burnished 22K gold.",
      desc: "The Surya — our sun — is the ring that started a thousand love stories. A brilliant-cut solitaire sits in a six-prong crown raised on a hand-burnished 22K gold band, designed to catch light from every angle. Each ring is finished over 40 hours by a single master karigar and individually inspected under 10x loupe before it leaves our atelier.",
      price: 189000, discount: 10, categoryId: catRings.id, collectionId: colHeritage.id,
      images: ["/images/products/ring-solitaire.png", "/images/products/ring-minimal.png"],
      material: "22K Yellow Gold · Natural Diamond", purity: "BIS 916 Hallmarked", weight: 4.8, dimensions: "Band 2.2mm · Stone 5.2mm",
      stock: 6, featured: true, best: true, craft: "Hand-burnished band, six-prong crown setting, 40+ hours of bench work per ring.",
      tags: ["solitaire", "diamond", "engagement", "heritage"],
      variants: [
        { name: "Size 6", size: "6", delta: 0, stock: 2 },
        { name: "Size 7", size: "7", delta: 0, stock: 2 },
        { name: "Size 8", size: "8", delta: 0, stock: 1 },
        { name: "Size 9", size: "9", delta: 0, stock: 1 },
      ],
    },
    {
      sku: "LN-RNG-002", slug: "meenakari-heritage-ring", name: "Meenakari Heritage Ring",
      short: "Temple-inspired filigree with a Burma ruby heart.",
      desc: "A love letter to Jaipur's meenakari tradition. Delicate gold filigree petals bloom around a vivacious Burma ruby, with hand-cut engraving across the shoulders. Worn by brides and collectors alike — this is heritage you can hold.",
      price: 74500, categoryId: catRings.id, collectionId: colHeritage.id,
      images: ["/images/products/ring-heritage.png"], material: "22K Yellow Gold · Burma Ruby", purity: "BIS 916 Hallmarked",
      weight: 5.6, dimensions: "Face 14mm × 12mm", stock: 3, threshold: 2, trending: true,
      craft: "Hand-filigree and meenakari-inspired engraving by Jaipur karigars.",
      tags: ["ruby", "filigree", "heritage", "statement"],
      variants: [{ name: "Size 7", size: "7", delta: 0, stock: 2 }, { name: "Size 8", size: "8", delta: 0, stock: 1 }],
    },
    {
      sku: "LN-RNG-003", slug: "eterna-whisper-band", name: "Eterna Whisper Band",
      short: "The everyday 18K gold band with a mirror-brushed finish.",
      desc: "Understated, weightless, eternal. The Eterna band is brushed to a soft satin glow and comfort-fit for 24/7 wear. Stack it, gift it, or make it your quiet signature.",
      price: 32900, categoryId: catRings.id, collectionId: colMinimal.id,
      images: ["/images/products/ring-minimal.png"], material: "18K Yellow Gold", purity: "BIS 750 Hallmarked",
      weight: 2.1, dimensions: "Band 1.8mm", stock: 12, ready: true,
      tags: ["band", "minimal", "everyday", "stackable"],
      variants: [{ name: "Size 6", size: "6", delta: 0, stock: 4 }, { name: "Size 7", size: "7", delta: 0, stock: 4 }, { name: "Size 8", size: "8", delta: 0, stock: 4 }],
    },
    {
      sku: "LN-NCK-001", slug: "kalash-emerald-pendant", name: "Kalash Emerald Pendant",
      short: "A teardrop Zambian emerald suspended on a fine gold chain.",
      desc: "One perfect drop of green. The Kalash pendant sets a hand-selected Zambian emerald in a minimal 22K gold bezel that lets the stone do all the talking. Arrives on an adjustable 16–18 inch chain.",
      price: 96000, discount: 5, categoryId: catNecklaces.id, collectionId: colMinimal.id,
      images: ["/images/products/necklace-pendant.png"], material: "22K Yellow Gold · Zambian Emerald", purity: "BIS 916 Hallmarked",
      weight: 3.4, dimensions: "Stone 8mm × 6mm · Chain 16–18in", stock: 5, featured: true,
      craft: "Bezel-set by hand; emeralds selected stone-by-stone at our Jaipur atelier.",
      tags: ["emerald", "pendant", "minimal", "gift"],
      variants: [{ name: "16 inch chain", size: "16in", delta: 0, stock: 3 }, { name: "18 inch chain", size: "18in", delta: 1500, stock: 2 }],
    },
    {
      sku: "LN-NCK-002", slug: "devi-temple-choker", name: "Devi Temple Choker",
      short: "South-Indian temple work in stately 22K gold.",
      desc: "The Devi choker reimagines classical temple jewellery with architectural repoussé panels of Lakshmi motifs, finished with detachable pearl drops. A ceremony in itself — heirloom weight, heirloom presence.",
      price: 342000, categoryId: catNecklaces.id, collectionId: colBridal.id,
      images: ["/images/products/necklace-choker.png"], material: "22K Yellow Gold · Pearls", purity: "BIS 916 Hallmarked",
      weight: 48.2, dimensions: "Adjustable 12–14in", stock: 2, threshold: 1, featured: true, handmade: true, ready: false,
      craft: "Repoussé temple panels raised entirely by hand; 6 weeks of karigar time per piece.",
      tags: ["choker", "bridal", "temple", "heirloom"],
      variants: [{ name: "Standard fit", delta: 0, stock: 2 }],
    },
    {
      sku: "LN-NCK-003", slug: "gauri-bridal-layered-set", name: "Gauri Bridal Layered Set",
      short: "A three-layer bridal treasury with matching jhumkas.",
      desc: "For the bride who wants the full gilded moment: a rani haar, a mid-layer temple necklace and a close choker, completed with twin jhumkas. Each layer can be worn separately long after the wedding — twenty pieces of jewellery in one.",
      price: 875000, categoryId: catNecklaces.id, collectionId: colBridal.id,
      images: ["/images/products/necklace-bridal.png"], material: "22K Yellow Gold · Pearls · CZ", purity: "BIS 916 Hallmarked",
      weight: 112.5, dimensions: "Layered 14 / 18 / 22in", stock: 1, threshold: 1, handmade: true, ready: false, featured: true,
      craft: "Made-to-order over 8 weeks; assembled and knotted strand-by-strand.",
      tags: ["bridal", "set", "layered", "made-to-order"],
    },
    {
      sku: "LN-EAR-001", slug: "noor-diamond-studs", name: "Noor Diamond Studs",
      short: "Light in its purest form — 0.3ct total diamond studs.",
      desc: "Noor means light. These everyday solitaire studs pair matched brilliant diamonds with secure screw-back closures in 18K gold — the first piece you reach for and the last one you take off.",
      price: 64800, discount: 8, categoryId: catEarrings.id, collectionId: colMinimal.id,
      images: ["/images/products/earrings-stud.png"], material: "18K Yellow Gold · Natural Diamonds", purity: "BIS 750 Hallmarked",
      weight: 1.9, dimensions: "Stone 3.8mm each", stock: 8, best: true,
      tags: ["studs", "diamond", "everyday", "gift"],
      variants: [{ name: "Single pair", delta: 0, stock: 8 }],
    },
    {
      sku: "LN-EAR-002", slug: "raag-jhumka-earrings", name: "Raag Jhumka Earrings",
      short: "Classical jhumkas with a cascade of seed pearls.",
      desc: "Every movement becomes music. The Raag jhumkas pair hand-domed gold bells with a delicate fringe of seed pearls that sway with every step. Light enough for all-night celebrations.",
      price: 88500, categoryId: catEarrings.id, collectionId: colHeritage.id,
      images: ["/images/products/earrings-jhumka.png"], material: "22K Yellow Gold · Seed Pearls", purity: "BIS 916 Hallmarked",
      weight: 9.7, dimensions: "Drop 42mm", stock: 4, trending: true,
      craft: "Hand-domed bells; pearl strands individually knotted.",
      tags: ["jhumka", "pearl", "festive", "traditional"],
      variants: [{ name: "Standard", delta: 0, stock: 3 }, { name: "With ear chains", delta: 3500, stock: 1 }],
    },
    {
      sku: "LN-EAR-003", slug: "luna-twist-hoops", name: "Luna Twist Hoops",
      short: "Sculptural rope-twist hoops in polished 18K.",
      desc: "A quiet statement. Luna hoops twist light along their rope-textured length, hinged for effortless wear. Day-to-night gold that flatters everything.",
      price: 41200, categoryId: catEarrings.id, collectionId: colMinimal.id,
      images: ["/images/products/earrings-hoops.png"], material: "18K Yellow Gold", purity: "BIS 750 Hallmarked",
      weight: 4.3, dimensions: "26mm diameter", stock: 10,
      tags: ["hoops", "minimal", "everyday"],
      variants: [{ name: "Standard", delta: 0, stock: 10 }],
    },
    {
      sku: "LN-BNG-001", slug: "triveni-bangle-trio", name: "Triveni Bangle Trio",
      short: "Three engraved bangles, one harmonic stack.",
      desc: "Three is auspicious. The Triveni trio layers two finely engraved kadas with a plain mirror-polish bangle — designed to chime softly and stack beautifully. Sold as a set of three.",
      price: 156000, discount: 5, categoryId: catBracelets.id, collectionId: colHeritage.id,
      images: ["/images/products/bangle-classic.png"], material: "22K Yellow Gold", purity: "BIS 916 Hallmarked",
      weight: 22.8, dimensions: "2.6 width × 62mm inner", stock: 3, best: true,
      tags: ["bangles", "set", "festive"],
      variants: [{ name: "2.4 size", size: "2.4", delta: 0, stock: 1 }, { name: "2.6 size", size: "2.6", delta: 0, stock: 1 }, { name: "2.8 size", size: "2.8", delta: 6000, stock: 1 }],
    },
    {
      sku: "LN-BRC-002", slug: "sutra-handchain-bracelet", name: "Sutra Handmade Chain Bracelet",
      short: "Hand-linked gold chain with a signature heart clasp.",
      desc: "Every link soldered by hand, every join polished invisible. The Sutra bracelet is our karigars' daily meditation — and the heart clasp is pure poetry.",
      price: 52800, categoryId: catBracelets.id, collectionId: colArtisan.id,
      images: ["/images/products/bracelet-chain.png"], material: "22K Yellow Gold", purity: "BIS 916 Hallmarked",
      weight: 6.9, dimensions: "7.5in + extender", stock: 5, handmade: true,
      craft: "Hand-linked and hand-soldered chain; signature heart clasp.",
      tags: ["bracelet", "handmade", "gift", "artisan"],
      variants: [{ name: "7.5 inch", size: "7.5in", delta: 0, stock: 3 }, { name: "8 inch", size: "8in", delta: 4200, stock: 2 }],
    },
    {
      sku: "LN-PND-004", slug: "bhaav-hammered-ruby-pendant", name: "Bhaav Hammered Ruby Pendant",
      short: "One-of-one hammered gold with a raw ruby soul. Only 1 ever made.",
      desc: "Bhaav — feeling, emotion. A single pendant hammered and chased entirely by hand, its surface holding the memory of every hammer fall, set with an untreated star ruby. This is a one-of-a-kind piece; when it's gone, it's gone.",
      price: 67300, categoryId: catNecklaces.id, collectionId: colArtisan.id,
      images: ["/images/products/pendant-handmade.png"], material: "22K Yellow Gold · Star Ruby", purity: "BIS 916 Hallmarked",
      weight: 7.8, dimensions: "Pendant 24mm × 16mm · Chain 18in", stock: 1, threshold: 1, handmade: true, trending: true,
      craft: "Hand-hammered texture; untreated star ruby in a raised bezel. One-of-one.",
      tags: ["one-of-a-kind", "handmade", "ruby", "artisan"],
    },
    {
      sku: "LN-RNG-004", slug: "ln-signet-ring", name: "LN Signet Ring",
      short: "A modern heirloom signet ready for your monogram.",
      desc: "The classic signet, softened. A gently domed oval face in heavy 18K gold awaits your engraver's touch — we offer complimentary monogram engraving on request via WhatsApp.",
      price: 56500, categoryId: catRings.id, collectionId: colMinimal.id,
      images: ["/images/products/ring-minimal.png", "/images/products/ring-solitaire.png"], material: "18K Yellow Gold",
      purity: "BIS 750 Hallmarked", weight: 6.4, dimensions: "Face 13mm × 11mm", stock: 7,
      tags: ["signet", "unisex", "engraving"],
      variants: [{ name: "Size 7", size: "7", delta: 0, stock: 3 }, { name: "Size 9", size: "9", delta: 0, stock: 2 }, { name: "Size 11", size: "11", delta: 0, stock: 2 }],
    },
    {
      sku: "LN-EAR-004", slug: "ganga-cascade-earrings", name: "Ganga Cascade Earrings",
      short: "Waterfall gold strands for celebratory nights.",
      desc: "Liquid gold. Nine hand-polished strands cascade from a sculpted crest — designed to catch candlelight at every turn of the head. Statement weight without the strain.",
      price: 121000, categoryId: catEarrings.id, collectionId: colBridal.id,
      images: ["/images/products/earrings-jhumka.png", "/images/products/earrings-stud.png"], material: "22K Yellow Gold",
      purity: "BIS 916 Hallmarked", weight: 16.4, dimensions: "Drop 58mm", stock: 0, trending: true,
      craft: "Nine individually soldered strands per earring.",
      tags: ["statement", "bridal", "festive"],
    },
  ];

  const careText = care;
  for (const p of P) {
    const product = await db.product.create({
      data: {
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        shortDescription: p.short,
        description: p.desc,
        price: p.price,
        discountPercent: p.discount ?? 0,
        categoryId: p.categoryId,
        collectionId: p.collectionId,
        images: JSON.stringify(p.images),
        material: p.material,
        purity: p.purity,
        weightGrams: p.weight,
        dimensions: p.dimensions,
        stock: p.stock,
        lowStockThreshold: p.threshold ?? 3,
        featured: p.featured ?? false,
        bestSeller: p.best ?? false,
        trending: p.trending ?? false,
        handmade: p.handmade ?? false,
        readyToShip: p.ready ?? true,
        craftsmanship: p.craft ?? null,
        careInstructions: careText,
        status: "PUBLISHED",
        tags: JSON.stringify(p.tags),
      },
    });
    if (p.variants?.length) {
      for (const v of p.variants) {
        await db.productVariant.create({
          data: { productId: product.id, name: v.name, size: v.size ?? null, priceDelta: v.delta, stock: v.stock },
        });
      }
    }
    await db.inventoryMovement.create({
      data: { productId: product.id, delta: p.stock, reason: "INIT", note: "Opening stock", actor: "seed" },
    });
  }
  console.log(`✓ ${P.length} products seeded`);

  // ---------- Reviews ----------
  const allProducts = await db.product.findMany();
  const bySlug = new Map(allProducts.map((p) => [p.slug, p]));
  const reviews = [
    { slug: "surya-solitaire-ring", name: "Ananya Sharma", rating: 5, title: "Beyond my dreams", comment: "My fiancé chose the Surya ring and it is even more beautiful in person. The packaging, the certificate, the handwritten note — everything felt like a ceremony.", approved: true },
    { slug: "surya-solitaire-ring", name: "Rahul M.", rating: 5, title: "She said yes!", comment: "Perfect weight, incredible sparkle. The team helped me pick the size over WhatsApp within minutes.", approved: true },
    { slug: "devi-temple-choker", name: "Priya Desai", rating: 5, title: "A family heirloom already", comment: "Wore it for my sister's wedding and three aunts have already ordered one. The temple work is unbelievably fine.", approved: true },
    { slug: "noor-diamond-studs", name: "Kavya Nair", rating: 4, title: "My everyday glow", comment: "Wear them to work and to parties. Wish the box was bigger but the studs themselves are flawless.", approved: true },
    { slug: "raag-jhumka-earrings", name: "Meera Iyer", rating: 5, title: "So lightweight!", comment: "Danced all night at my cousin's sangeet and forgot I was wearing them. The pearl drops are so delicate.", approved: true },
    { slug: "triveni-bangle-trio", name: "Sunita Agarwal", rating: 5, title: "The chime is addictive", comment: "The engraving is traditional yet the stack feels modern. Exactly what I wanted for Karwa Chauth.", approved: true },
  ];
  for (const r of reviews) {
    const p = bySlug.get(r.slug);
    if (p) await db.review.create({ data: { productId: p.id, name: r.name, rating: r.rating, title: r.title, comment: r.comment, approved: r.approved } });
  }
  await db.review.create({
    data: { productId: bySlug.get("luna-twist-hoops")!.id, name: "Tanya K.", rating: 5, title: "Obsessed", comment: "Third purchase from LN Jewellers this year. Consistency is their real luxury.", approved: false },
  });
  console.log("✓ Reviews");

  // ---------- Sample orders ----------
  const surya = bySlug.get("surya-solitaire-ring")!;
  const noor = bySlug.get("noor-diamond-studs")!;
  const order1 = await db.order.create({
    data: {
      orderNumber: "LN-20250101-DEMO1",
      customerName: "Ananya Sharma", email: "ananya@example.com", phone: "+91 98200 11223",
      address: "14 Marine Drive, Apartment 3B", city: "Mumbai", state: "Maharashtra", pincode: "400020",
      subtotal: 170100, shipping: 0, tax: 5103, total: 175203,
      status: "SHIPPED", paymentMethod: "WHATSAPP", paymentStatus: "PAID",
      items: { create: [{ productId: surya.id, name: surya.name, sku: surya.sku, image: "/images/products/ring-solitaire.png", unitPrice: 170100, quantity: 1, lineTotal: 170100 }] },
    },
  });
  const order2 = await db.order.create({
    data: {
      orderNumber: "LN-20250102-DEMO2",
      customerName: "Kavya Nair", email: "kavya@example.com", phone: "+91 98450 55667",
      address: "22 Brigade Road", city: "Bengaluru", state: "Karnataka", pincode: "560025",
      subtotal: 59616, shipping: 199, tax: 1788, total: 61603,
      status: "PLACED", paymentMethod: "WHATSAPP", paymentStatus: "UNPAID",
      items: { create: [{ productId: noor.id, name: noor.name, sku: noor.sku, image: "/images/products/earrings-stud.png", unitPrice: 59616, quantity: 1, lineTotal: 59616 }] },
    },
  });
  console.log("✓ Sample orders:", order1.orderNumber, order2.orderNumber);

  // ---------- Inquiries & subscribers ----------
  await db.contactInquiry.createMany({
    data: [
      { name: "Ritu Malhotra", email: "ritu@example.com", phone: "+91 98111 22334", subject: "Custom bridal set enquiry", message: "Hi! I'm getting married in November and love the Gauri set. Can it be customised with emeralds instead of pearls? What timelines should I plan for?", status: "NEW" },
      { name: "Arjun Rao", email: "arjun@example.com", subject: "Ring resizing", message: "I ordered a size 7 Surya ring but need a size 8. What is the resizing policy?", status: "NEW" },
    ],
  });
  await db.newsletterSubscriber.createMany({
    data: [{ email: "ananya@example.com" }, { email: "priya@example.com" }, { email: "meera@example.com" }, { email: "collector@example.com" }],
  });
  console.log("✓ Inquiries & subscribers");

  // ---------- Store settings ----------
  const faq = [
    { q: "Is your gold hallmarked?", a: "Yes. Every 22K piece carries a BIS 916 hallmark and every 18K piece carries a BIS 750 hallmark from a Government-approved Assaying & Hallmarking centre. The hallmark number for your specific piece is shared before dispatch." },
    { q: "What is the difference between ready-to-ship and made-to-order?", a: "Ready-to-ship pieces are dispatched within 48 hours. Made-to-order pieces (marked on each product) are individually crafted for you and typically take 3–8 weeks depending on complexity. Timelines are confirmed on WhatsApp before you pay." },
    { q: "How do I order through WhatsApp?", a: "Add pieces to your cart and choose 'Order via WhatsApp' at checkout. We generate a complete order message — you just review and press send. Our concierge confirms availability, payment and delivery personally." },
    { q: "Do you buy back gold?", a: "We offer exchange on unworn pieces within 30 days and gold-value exchange thereafter, subject to prevailing rates and hallmark verification. Full policy on our Returns page." },
    { q: "Do you ship internationally?", a: "We currently ship across India with insured courier. International shipping to select countries is available on request via WhatsApp with full insurance and duties quoted upfront." },
    { q: "Can I customise a design?", a: "Absolutely — bespoke is our favourite word. Message us on WhatsApp with your idea, budget and timeline. Our design team responds with sketches and a quote within 48 hours." },
  ];
  const testimonials = [
    { name: "Ananya Sharma", location: "Mumbai", text: "The Surya ring is even more beautiful in person. Everything — packaging to the handwritten note — felt like a ceremony.", rating: 5 },
    { name: "Priya Desai", location: "Hyderabad", text: "Three aunts have already ordered after seeing my Devi choker. The temple work is unbelievably fine.", rating: 5 },
    { name: "Meera Iyer", location: "Chennai", text: "Danced all night at a sangeet and forgot I was wearing the Raag jhumkas. Feather-light, heirloom-fine.", rating: 5 },
    { name: "Sunita Agarwal", location: "Jaipur", text: "The Triveni bangles chime so softly and stack beautifully. Exactly what I wanted for Karwa Chauth.", rating: 5 },
  ];
  const gallery = [
    "/images/products/ring-solitaire.png", "/images/products/necklace-choker.png", "/images/products/earrings-jhumka.png",
    "/images/products/bangle-classic.png", "/images/products/pendant-handmade.png", "/images/products/necklace-bridal.png",
    "/images/products/earrings-hoops.png", "/images/products/bracelet-chain.png",
  ];
  await db.storeSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      aboutStory:
        "LN Jewellers began in 2016 at a two-bench workshop in Johari Bazaar, Jaipur — with one master karigar, a sheet of 22K gold and a stubborn belief that real luxury is made slowly.\n\nToday our atelier spans twelve artisans, but nothing about our process has rushed. Every piece is still drawn by hand, filed by hand, set by hand and inspected under a loupe before it earns the LN Jewellers name. We buy our gold fromrefiners certified by the Responsible Jewellery Council and our gemstones from family dealers we have known for decades.\n\nWe don't do fast fashion and we don't do inflated making charges. We do jewellery meant to outlive trends — and us.",
      missionVision:
        "Mission: To make heirloom-quality handcrafted gold jewellery accessible with radical transparency — honest weights, hallmarked purity and making charges you can actually understand.\n\nVision: A world where every woman owns at least one piece of jewellery that tells her story, made by hands that were paid and treated with dignity.",
      shippingPolicy:
        "Ready-to-ship pieces are dispatched within 48 working hours via fully insured courier (Blue Dart / Sequel) with signature-on-delivery.\n\n• Free insured shipping on orders above ₹50,000. A flat ₹199 applies below that.\n• Made-to-order timelines are confirmed personally before payment.\n• Every parcel is discreet — plain outer box, no brand names.\n• Cash on Delivery is available up to ₹50,000.\n• International shipping on request via WhatsApp, duties quoted upfront.",
      returnsPolicy:
        "We accept returns of unworn, unengraved pieces in original packaging within 30 days of delivery for a full refund or exchange.\n\n• Refunds are processed to source within 5–7 working days of QC receipt.\n• Made-to-order and bespoke pieces are exchange-only.\n• Engraved and resized pieces are exchange-only for gold value.\n• To raise a return, message us on WhatsApp with your order number — we arrange a complimentary insured pickup.",
      privacyPolicy:
        "We collect only what we need to craft, ship and care for your jewellery: your name, contact details, addresses and order history.\n\n• We never sell or rent your data. Ever.\n• Payment details are handled by our PCI-DSS compliant payment partners; we never see or store card numbers.\n• WhatsApp messages are used only to service your orders and enquiries.\n• You may request a copy or deletion of your data anytime at hello@lnjewellers.com.",
      termsPolicy:
        "By using this website you agree to these terms.\n\n• All prices are in INR and include GST as shown at checkout. Gold prices are locked at order confirmation.\n• Product photography is illustrative; natural gemstones vary slightly in tone — that is their nature, not a defect.\n• Hallmark weights may vary ±0.20g from listed weight; you are billed on actual hallmark weight, never more.\n• All designs remain the intellectual property of LN Jewellers.\n• Disputes are subject to the exclusive jurisdiction of courts in Jaipur, Rajasthan.",
      faq: JSON.stringify(faq),
      testimonials: JSON.stringify(testimonials),
      instagramGallery: JSON.stringify(gallery),
    },
    update: {},
  });
  console.log("✓ Store settings");

  await db.auditLog.create({
    data: { actor: "seed", action: "SEED", entity: "Database", details: `Seeded ${P.length} products, 2 orders, ${reviews.length} reviews` },
  });

  console.log("\n🎉 Seed complete!");
  console.log(`   Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
