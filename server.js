/**
 * server.js  —  VisualVault Brand Kit Delivery Server v2
 *
 * Flux complet entièrement automatisé — aucun template pré-fait requis.
 *
 *  Shopify order/paid
 *        ↓
 *  Vérification HMAC
 *        ↓
 *  extractKitProperties()      ← lit Sector / Style / Brand Name
 *        ↓
 *  generateBrandIdentity()     ← GPT-4o logo SVG + textes + DALL-E 3 hero
 *        ↓
 *  CanvaService.createClientKit() ← upload logo + autofill templates + partage
 *        ↓
 *  generateBrandKitPage()      ← page HTML brand kit autonome
 *        ↓
 *  sendDeliveryEmail()         ← email HTML avec page + liens Canva
 */

require('dotenv').config();

const express  = require('express');
const crypto   = require('crypto');

const { generateBrandIdentity }  = require('./brand-engine');
const CanvaService               = require('./canva-service');
const { generateBrandKitPage }   = require('./kit-page-generator');
const { sendDeliveryEmail }      = require('./email-service');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS — autorise les appels depuis la boutique Shopify ─────────────────────
const ALLOWED_ORIGINS = [
  'https://visualvault-store.myshopify.com',
  process.env.SHOPIFY_STORE_DOMAIN ? `https://${process.env.SHOPIFY_STORE_DOMAIN}` : null,
  'http://localhost:3000',  // dev local
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Raw body pour la vérification HMAC Shopify ────────────────────────────────
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// ── Vérification HMAC ─────────────────────────────────────────────────────────
function verifyShopify(req) {
  const sig = req.headers['x-shopify-hmac-sha256'];
  // FIX: vérifier rawBody avant de l'utiliser (absent sur requêtes GET, etc.)
  if (!sig || !process.env.SHOPIFY_WEBHOOK_SECRET || !req.rawBody) return false;
  try {
    const computed = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest('base64');
    const sigBuf  = Buffer.from(sig, 'base64');
    const compBuf = Buffer.from(computed, 'base64');
    // timingSafeEqual exige des buffers de même longueur
    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  } catch { return false; }
}

// ── Extraction des propriétés de commande ─────────────────────────────────────
function extractKitProperties(order) {
  for (const item of order.line_items || []) {
    const props = {};
    for (const { name, value } of item.properties || []) {
      props[name.toLowerCase().replace(/[\s_-]+/g, '_')] = value;
    }
    const sector    = props.sector;
    const style     = props.style;
    const brandName = props.brand_name;

    if (sector && style && brandName) {
      return {
        sector,
        style,
        brandName,
        customerEmail: order.email,
        customerName:  [
          order.billing_address?.first_name,
          order.billing_address?.last_name,
        ].filter(Boolean).join(' ') || order.email,
        orderId:   order.id,
        orderName: order.name,
      };
    }
  }
  return null;
}

// ── Pipeline principal de livraison ───────────────────────────────────────────
async function deliverKit({ sector, style, brandName, customerEmail, customerName, orderId }) {
  console.log(`\n[Kit] ▶ Starting delivery — order ${orderId}`);
  console.log(`[Kit]   Brand: "${brandName}" · Sector: ${sector} · Style: ${style}`);
  console.log(`[Kit]   Client: ${customerEmail}`);

  // ── Étape 1 : Générer l'identité par IA ──────────────────────────────────
  const identity = await generateBrandIdentity(brandName, sector, style);

  // ── Étape 2 : Créer les designs Canva ────────────────────────────────────
  let canvaResult = { editUrls: {}, folderId: null };
  if (process.env.CANVA_ACCESS_TOKEN && hasAtLeastOneTemplate()) {
    try {
      // FIX: CanvaService constructor throws if token missing — wrap ici
      const canva = new CanvaService(process.env.CANVA_ACCESS_TOKEN);
      canvaResult = await canva.createClientKit(identity, customerEmail);
    } catch (err) {
      console.warn('[Kit] Canva step failed (non-blocking):', err.message);
    }
  } else {
    console.warn('[Kit] Canva skipped — no access token or templates configured');
  }

  // ── Étape 3 : Générer la page HTML brand kit ──────────────────────────────
  const kitHtml = generateBrandKitPage(identity, canvaResult.editUrls);

  // ── Étape 4 : Envoyer l'email ─────────────────────────────────────────────
  await sendDeliveryEmail({
    customerEmail,
    customerName,
    identity,
    canvaEditUrls: canvaResult.editUrls,
    kitHtml,
  });

  console.log(`[Kit] ✓ Delivered to ${customerEmail}`);
  return { identity, canvaResult };
}

function hasAtLeastOneTemplate() {
  return !!(
    process.env.CANVA_TPL_LOGO ||
    process.env.CANVA_TPL_INSTAGRAM ||
    process.env.CANVA_TPL_STORY ||
    process.env.CANVA_TPL_BUSINESS_CARD ||
    process.env.CANVA_TPL_EMAIL_HEADER
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────

// ── /generate-preview  — appelé depuis la page Shopify avant l'achat ──────────
//
// Reçoit { sector, style, brandName }
// Retourne { logoSvg, tagline, brandVoice, brandStory, palette, typography }
// en ~5-8 secondes (GPT-4o uniquement, pas de DALL-E pour rester rapide)
//
app.post('/generate-preview', async (req, res) => {
  const { sector, style, brandName } = req.body || {};

  if (!sector || !style || !brandName) {
    return res.status(400).json({ error: 'sector, style and brandName are required' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI not configured on server' });
  }

  try {
    const { generateBrandIdentity } = require('./brand-engine');
    // On passe heroImage=false pour éviter DALL-E 3 (trop long pour un preview)
    const identity = await generateBrandIdentity(brandName, sector, style, { skipHero: true });
    res.json({
      logoSvg:    identity.logoSvg,
      tagline:    identity.tagline,
      brandVoice: identity.brandVoice,
      brandStory: identity.brandStory,
      palette:    identity.palette,
      typography: identity.typography,
    });
  } catch (err) {
    console.error('[Preview] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    canva: !!process.env.CANVA_ACCESS_TOKEN,
    openai: !!process.env.OPENAI_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
    templates: {
      logo:          !!process.env.CANVA_TPL_LOGO,
      instagram:     !!process.env.CANVA_TPL_INSTAGRAM,
      story:         !!process.env.CANVA_TPL_STORY,
      business_card: !!process.env.CANVA_TPL_BUSINESS_CARD,
      email_header:  !!process.env.CANVA_TPL_EMAIL_HEADER,
    },
  });
});

/**
 * POST /webhooks/orders/paid
 * Webhook Shopify : orders/paid
 */
app.post('/webhooks/orders/paid', (req, res) => {
  if (!verifyShopify(req)) {
    console.warn('[Webhook] Invalid HMAC — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Répondre 200 immédiatement (Shopify exige < 5s)
  res.status(200).json({ received: true });

  const order = req.body;
  console.log(`[Webhook] Order received: ${order.name}`);

  const props = extractKitProperties(order);
  if (!props) {
    console.log(`[Webhook] No kit properties in order ${order.name} — skipped`);
    return;
  }

  // Traitement en arrière-plan
  deliverKit(props).catch((err) => {
    console.error(`[Kit] ✗ Delivery failed for ${order.name}:`, err.message, err.stack);
    // TODO: envoyer une alerte Slack/email interne pour retry manuel
  });
});

/**
 * POST /test
 * Route de test (désactivée en production)
 * Usage: curl -X POST http://localhost:3000/test \
 *   -H "Content-Type: application/json" \
 *   -d '{"sector":"beauty","style":"elegant","brand_name":"Luna Studio","email":"client@example.com"}'
 */
if (process.env.NODE_ENV !== 'production') {
  app.post('/test', async (req, res) => {
    const { sector, style, brand_name, email, name } = req.body;
    if (!sector || !style || !brand_name || !email) {
      return res.status(400).json({ error: 'Required: sector, style, brand_name, email' });
    }
    try {
      const result = await deliverKit({
        sector,
        style,
        brandName: brand_name,
        customerEmail: email,
        customerName: name || 'Test Client',
        orderId: `TEST-${Date.now()}`,
        orderName: '#TEST',
      });
      res.json({
        success: true,
        tagline: result.identity.tagline,
        brandVoice: result.identity.brandVoice,
        palette: result.identity.palette,
        canvaUrls: result.canvaResult.editUrls,
      });
    } catch (err) {
      console.error('[Test] Error:', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  /**
   * GET /preview?sector=beauty&style=elegant&brand=Luna+Studio
   * Prévisualiser la page brand kit générée dans le navigateur
   */
  app.get('/preview', async (req, res) => {
    const { sector = 'beauty', style = 'elegant', brand = 'Luna Studio' } = req.query;
    try {
      const identity = await generateBrandIdentity(brand, sector, style);
      const html = generateBrandKitPage(identity, {});
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(500).send(`<pre>Error: ${err.message}\n\n${err.stack}</pre>`);
    }
  });
}

app.listen(PORT, () => {
  console.log(`\n✦ VisualVault Brand Kit Server`);
  console.log(`  Port    : ${PORT}`);
  console.log(`  OpenAI  : ${process.env.OPENAI_API_KEY ? '✓' : '✗ missing'}`);
  console.log(`  Canva   : ${process.env.CANVA_ACCESS_TOKEN ? '✓' : '✗ missing'}`);
  console.log(`  Resend  : ${process.env.RESEND_API_KEY ? '✓' : '✗ missing'}`);
  console.log(`  Env     : ${process.env.NODE_ENV || 'development'}\n`);
});
