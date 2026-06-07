/**
 * brand-engine.js
 *
 * Le cœur du système : génère TOUT l'identité visuelle par IA.
 * Aucun template pré-fait. Chaque client reçoit une identité unique.
 *
 * Ce qui est généré :
 *  1. Palette de couleurs  → algorithmique (déterministe par secteur+style)
 *  2. Typographie          → algorithmique
 *  3. Logo SVG             → GPT-4o génère du code SVG propre
 *  4. Textes de marque     → GPT-4o (tagline, brand voice, brand story)
 *  5. Image hero           → DALL-E 3 (visuel identitaire principal)
 */

const https = require('https');

// ── Palettes déterministes par secteur×style ──────────────────────────────────

const PALETTES = {
  beauty: {
    minimal:  { primary: '#F5E6D3', secondary: '#C4956A', accent: '#8B5E3C', bg: '#FDFAF7', text: '#2C1810' },
    bold:     { primary: '#FF1744', secondary: '#212121', accent: '#FF6D00', bg: '#FAFAFA', text: '#212121' },
    elegant:  { primary: '#C9A96E', secondary: '#1A1A1A', accent: '#E8D5B7', bg: '#FEFEFE', text: '#1A1A1A' },
  },
  tech: {
    minimal:  { primary: '#0066FF', secondary: '#F0F4FF', accent: '#00D4AA', bg: '#FFFFFF', text: '#0D0D0D' },
    bold:     { primary: '#6C00FF', secondary: '#0A0A0F', accent: '#00E5FF', bg: '#0A0A0F', text: '#FFFFFF' },
    elegant:  { primary: '#1B2B4B', secondary: '#C0C8D8', accent: '#4A6FA5', bg: '#F7F9FC', text: '#1B2B4B' },
  },
  fitness: {
    minimal:  { primary: '#2D2D2D', secondary: '#E8E8E8', accent: '#FF5722', bg: '#FFFFFF', text: '#2D2D2D' },
    bold:     { primary: '#FF3D00', secondary: '#121212', accent: '#FFEA00', bg: '#121212', text: '#FFFFFF' },
    elegant:  { primary: '#2E4A3E', secondary: '#A8C5A0', accent: '#D4AF37', bg: '#F9F6F0', text: '#2E4A3E' },
  },
  fashion: {
    minimal:  { primary: '#1A1A1A', secondary: '#F5F5F0', accent: '#C8B89A', bg: '#F5F5F0', text: '#1A1A1A' },
    bold:     { primary: '#E91E8C', secondary: '#1A1A1A', accent: '#FFD700', bg: '#FAFAFA', text: '#1A1A1A' },
    elegant:  { primary: '#8B7355', secondary: '#F2EDE4', accent: '#2C2C2C', bg: '#FEFCF9', text: '#2C2C2C' },
  },
  food: {
    minimal:  { primary: '#4A7C59', secondary: '#F5F0E8', accent: '#E07B39', bg: '#FDFBF7', text: '#2C2C2C' },
    bold:     { primary: '#D32F2F', secondary: '#FFF8E1', accent: '#FF8F00', bg: '#FFFFFF', text: '#1A1A1A' },
    elegant:  { primary: '#795548', secondary: '#EFEBE9', accent: '#D4AF37', bg: '#FBF8F5', text: '#3E2723' },
  },
  photography: {
    minimal:  { primary: '#212121', secondary: '#FAFAFA', accent: '#757575', bg: '#FFFFFF', text: '#212121' },
    bold:     { primary: '#000000', secondary: '#FF4081', accent: '#FFAB40', bg: '#FAFAFA', text: '#000000' },
    elegant:  { primary: '#37474F', secondary: '#ECEFF1', accent: '#B0BEC5', bg: '#FAFBFC', text: '#263238' },
  },
};

const TYPOGRAPHY = {
  minimal:  { heading: 'Inter',              body: 'Inter',          weight: '300/600' },
  bold:     { heading: 'Montserrat',         body: 'Open Sans',      weight: '800/400' },
  elegant:  { heading: 'Playfair Display',   body: 'Lato',           weight: '400/300' },
};

// ── Utilitaire requête OpenAI ─────────────────────────────────────────────────

function openaiRequest(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.openai.com',
      path: `/v1/${endpoint}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`OpenAI ${res.statusCode}: ${parsed.error?.message}`));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── 1. Palette + Typography ───────────────────────────────────────────────────

function getPalette(sector, style) {
  const s = sector.toLowerCase();
  const st = style.toLowerCase();
  return (
    PALETTES[s]?.[st] ||
    PALETTES[s]?.minimal ||
    PALETTES.tech.minimal   // fallback ultime
  );
}

function getTypography(style) {
  return TYPOGRAPHY[style.toLowerCase()] || TYPOGRAPHY.minimal;
}

// ── 2. Textes de marque (GPT-4o) ─────────────────────────────────────────────

async function generateBrandText(brandName, sector, style) {
  const prompt = `You are a senior brand strategist. Create a complete brand identity text package for the following brand:

Brand name: "${brandName}"
Industry/Sector: ${sector}
Visual style: ${style}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "tagline": "A 5-8 word punchy brand tagline",
  "brandStory": "A 2-sentence brand origin/mission story (max 40 words)",
  "brandVoice": "3 adjectives describing the brand voice, comma-separated",
  "targetAudience": "One sentence describing the target customer",
  "valueProposition": "One sentence: what makes this brand unique"
}`;

  const res = await openaiRequest('chat/completions', {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(res.choices[0].message.content);
}

// ── 3. Logo SVG (GPT-4o génère du code SVG) ──────────────────────────────────

async function generateLogoSVG(brandName, sector, style, palette) {
  // Initiales pour le logo (1 ou 2 caractères)
  const words = brandName.trim().split(/\s+/);
  const initials = words.length >= 2
    ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
    : words[0].substring(0, 2).toUpperCase();

  const prompt = `Create a professional SVG logo for a ${sector} brand called "${brandName}" (${style} style).

Design requirements:
- Initials to use: "${initials}"
- Primary color: ${palette.primary}
- Accent color: ${palette.accent}
- Background: transparent
- Style: ${style} (${style === 'minimal' ? 'clean, geometric, lots of whitespace' : style === 'bold' ? 'strong shapes, high contrast, dynamic' : 'refined, sophisticated, premium'})
- ViewBox: 0 0 400 400
- Must look professional and scalable

Return ONLY the SVG code. Start with <svg and end with </svg>. No explanation, no markdown.`;

  const res = await openaiRequest('chat/completions', {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 1200,
  });

  let svg = res.choices[0].message.content.trim();
  // Nettoyer les éventuels blocs markdown
  svg = svg.replace(/```svg\n?/gi, '').replace(/```\n?/gi, '').trim();
  if (!svg.startsWith('<svg')) svg = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  return svg;
}

// ── 4. Image hero (DALL-E 3) ─────────────────────────────────────────────────

async function generateHeroImage(brandName, sector, style, palette) {
  const styleDesc = {
    minimal: 'minimalist, clean white space, simple geometric shapes, Scandinavian design aesthetic',
    bold:    'bold graphic design, high contrast, dynamic composition, editorial photography style',
    elegant: 'luxury editorial, soft textures, sophisticated mood, high-end magazine aesthetic',
  };

  const sectorDesc = {
    beauty:      'beauty and cosmetics products, skincare, makeup',
    tech:        'technology, clean desk setup, digital devices',
    fitness:     'athletic lifestyle, movement, health and wellness',
    fashion:     'fashion editorial, clothing, lifestyle',
    food:        'food photography, culinary art, ingredients',
    photography: 'photography studio, camera, artistic composition',
  };

  const prompt = `Brand identity hero image for "${brandName}", a ${sectorDesc[sector.toLowerCase()] || sector} brand. ${styleDesc[style.toLowerCase()] || style} style. Color palette: ${palette.primary} and ${palette.accent}. No text, no logos, no watermarks. Square format, professional commercial photography quality.`;

  const res = await openaiRequest('images/generations', {
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    style: style.toLowerCase() === 'bold' ? 'vivid' : 'natural',
  });

  return res.data[0].url;
}

// ── Export principal ──────────────────────────────────────────────────────────

/**
 * Génère l'identité complète d'une marque par IA.
 *
 * @param {string} brandName
 * @param {string} sector
 * @param {string} style
 * @param {object} opts   { skipHero: bool } — passer skipHero:true pour le preview rapide
 * @returns {Promise<BrandIdentity>}
 */
async function generateBrandIdentity(brandName, sector, style, opts = {}) {
  console.log(`[BrandEngine] Generating identity for "${brandName}" (${sector}/${style})`);

  const palette    = getPalette(sector, style);
  const typography = getTypography(style);

  // Lancer GPT-4o en parallèle
  const heroPromise = opts.skipHero
    ? Promise.resolve(null)
    : generateHeroImage(brandName, sector, style, palette).catch((err) => {
        console.warn('[BrandEngine] Hero image generation failed (non-blocking):', err.message);
        return null;
      });

  const [brandText, logoSvg, heroImageUrl] = await Promise.all([
    generateBrandText(brandName, sector, style),
    generateLogoSVG(brandName, sector, style, palette),
    heroPromise,
  ]);

  const identity = {
    brandName,
    sector,
    style,
    palette,
    typography,
    ...brandText,   // tagline, brandStory, brandVoice, targetAudience, valueProposition
    logoSvg,
    heroImageUrl,
    generatedAt: new Date().toISOString(),
  };

  console.log(`[BrandEngine] Identity generated for "${brandName}" ✓`);
  return identity;
}

module.exports = { generateBrandIdentity, getPalette, getTypography };
