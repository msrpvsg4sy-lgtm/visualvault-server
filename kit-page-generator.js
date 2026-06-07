/**
 * kit-page-generator.js
 *
 * Génère une page HTML "Brand Kit" complète et autonome.
 * Aucune dépendance externe — tout est inline (CSS, polices Google Fonts).
 *
 * Le client reçoit cette page par email. Il peut :
 *   - L'ouvrir dans son navigateur → Ctrl+P → imprimer/sauvegarder en PDF
 *   - La partager avec un imprimeur
 *   - L'utiliser comme référence visuelle
 */

/**
 * @param {object} identity  Résultat complet de brand-engine.js
 * @param {object} canvaUrls { logo, instagram, story, business_card, email_header }
 * @returns {string} HTML complet
 */
function generateBrandKitPage(identity, canvaUrls = {}) {
  const {
    brandName, sector, style, palette, typography,
    tagline, brandStory, brandVoice, targetAudience, valueProposition,
    logoSvg, heroImageUrl, generatedAt,
  } = identity;

  const googleFont = encodeURIComponent(`${typography.heading}:wght@300;400;600;700|${typography.body}:wght@300;400`);
  const isDark = palette.bg === '#0A0A0F' || palette.bg === '#121212';
  const textOnPrimary = isDark ? '#FFFFFF' : palette.text;

  const colorSwatches = Object.entries({
    Primary:    palette.primary,
    Secondary:  palette.secondary,
    Accent:     palette.accent,
    Background: palette.bg,
    Text:       palette.text,
  }).map(([name, hex]) => `
    <div class="swatch">
      <div class="swatch-color" style="background:${hex}"></div>
      <div class="swatch-label">
        <strong>${name}</strong>
        <code>${hex}</code>
        <code>${hexToRgb(hex)}</code>
      </div>
    </div>
  `).join('');

  const canvaLinks = Object.entries(canvaUrls)
    .filter(([, url]) => !!url)
    .map(([format, url]) => `
      <a href="${url}" target="_blank" class="canva-link">
        <span class="canva-icon">✦</span>
        Edit ${format.replace('_', ' ')} in Canva →
      </a>
    `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandName} – Brand Kit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${googleFont}&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: ${palette.primary};
    --secondary: ${palette.secondary};
    --accent: ${palette.accent};
    --bg: ${palette.bg};
    --text: ${palette.text};
    --font-heading: '${typography.heading}', Georgia, serif;
    --font-body: '${typography.body}', Arial, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #f2f2f2;
    font-family: var(--font-body);
    color: #222;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: 900px;
    margin: 40px auto;
    background: #fff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.12);
  }

  /* ── Cover ── */
  .cover {
    background: var(--primary);
    color: ${textOnPrimary};
    padding: 80px 60px;
    position: relative;
    overflow: hidden;
  }
  .cover::after {
    content: '';
    position: absolute;
    right: -60px; top: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.15;
  }
  .cover-eyebrow {
    font-family: var(--font-body);
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    opacity: 0.7;
    margin-bottom: 16px;
  }
  .cover-brand {
    font-family: var(--font-heading);
    font-size: clamp(40px, 8vw, 72px);
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 16px;
  }
  .cover-tagline {
    font-size: 18px;
    font-weight: 300;
    opacity: 0.85;
    margin-bottom: 32px;
    max-width: 500px;
  }
  .cover-meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  .cover-badge {
    background: rgba(255,255,255,0.15);
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* ── Logo ── */
  .section { padding: 60px; border-bottom: 1px solid #f0f0f0; }
  .section:last-child { border-bottom: none; }
  .section-label {
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-label::after {
    content: ''; flex: 1;
    height: 1px; background: #f0f0f0;
  }
  h2 {
    font-family: var(--font-heading);
    font-size: 28px;
    color: #111;
    margin-bottom: 8px;
  }

  .logo-display {
    background: var(--bg);
    border-radius: 12px;
    padding: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    min-height: 200px;
  }
  .logo-display svg { max-width: 200px; max-height: 200px; }
  .logo-dark {
    background: #111;
  }
  .logo-variants {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }

  /* ── Colors ── */
  .swatches { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 24px; }
  .swatch {
    flex: 1; min-width: 140px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #f0f0f0;
  }
  .swatch-color { height: 80px; }
  .swatch-label { padding: 12px; }
  .swatch-label strong { display: block; font-size: 13px; color: #111; margin-bottom: 4px; }
  .swatch-label code { display: block; font-size: 11px; color: #888; font-family: monospace; }

  /* ── Typography ── */
  .type-sample {
    margin-top: 24px;
    padding: 32px;
    background: #fafafa;
    border-radius: 12px;
  }
  .type-heading {
    font-family: var(--font-heading);
    font-size: 48px;
    font-weight: 700;
    color: #111;
    line-height: 1.1;
    margin-bottom: 8px;
  }
  .type-subheading {
    font-family: var(--font-heading);
    font-size: 24px;
    font-weight: 400;
    color: #555;
    margin-bottom: 16px;
  }
  .type-body {
    font-family: var(--font-body);
    font-size: 16px;
    color: #444;
    line-height: 1.7;
    max-width: 600px;
  }
  .type-meta { font-size: 11px; color: #bbb; margin-top: 16px; letter-spacing: 1px; text-transform: uppercase; }

  /* ── Brand Voice ── */
  .brand-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 24px;
  }
  .brand-card {
    padding: 24px;
    border-radius: 12px;
    border: 1px solid #f0f0f0;
  }
  .brand-card-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #bbb; margin-bottom: 8px; }
  .brand-card-value { font-size: 15px; color: #222; line-height: 1.6; }

  /* ── Hero image ── */
  .hero-img {
    width: 100%;
    aspect-ratio: 1/1;
    object-fit: cover;
    border-radius: 12px;
    margin-top: 24px;
    display: block;
  }

  /* ── Canva Links ── */
  .canva-links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
  .canva-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: 2px solid var(--primary);
    border-radius: 8px;
    text-decoration: none;
    color: var(--primary);
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
  }
  .canva-link:hover { background: var(--primary); color: white; }
  .canva-icon { font-size: 16px; }

  /* ── Footer ── */
  .kit-footer {
    background: #111;
    color: #fff;
    padding: 40px 60px;
    text-align: center;
  }
  .kit-footer p { opacity: 0.5; font-size: 12px; line-height: 1.8; }

  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Cover -->
  <div class="cover">
    <p class="cover-eyebrow">Brand Identity Kit · VisualVault</p>
    <h1 class="cover-brand">${escHtml(brandName)}</h1>
    <p class="cover-tagline">${escHtml(tagline)}</p>
    <div class="cover-meta">
      <span class="cover-badge">${escHtml(sector)}</span>
      <span class="cover-badge">${escHtml(style)}</span>
      <span class="cover-badge">${typography.heading} · ${typography.body}</span>
    </div>
  </div>

  <!-- Logo -->
  <div class="section">
    <p class="section-label">01 · Logo</p>
    <h2>Your Logo</h2>
    <div class="logo-variants">
      <div>
        <p style="font-size:11px;color:#aaa;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase">Light background</p>
        <div class="logo-display">
          ${logoSvg || `<div style="font-family:var(--font-heading);font-size:48px;font-weight:700;color:var(--primary)">${escHtml(brandName.substring(0, 2).toUpperCase())}</div>`}
        </div>
      </div>
      <div>
        <p style="font-size:11px;color:#aaa;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase">Dark background</p>
        <div class="logo-display logo-dark">
          ${logoSvg
            ? logoSvg.replace(/fill="[^"]*"/g, 'fill="#fff"').replace(/stroke="[^"]*"/g, 'stroke="#fff"')
            : `<div style="font-family:var(--font-heading);font-size:48px;font-weight:700;color:#fff">${escHtml(brandName.substring(0, 2).toUpperCase())}</div>`
          }
        </div>
      </div>
    </div>
  </div>

  <!-- Colors -->
  <div class="section">
    <p class="section-label">02 · Color Palette</p>
    <h2>Brand Colors</h2>
    <div class="swatches">${colorSwatches}</div>
  </div>

  <!-- Typography -->
  <div class="section">
    <p class="section-label">03 · Typography</p>
    <h2>Brand Fonts</h2>
    <div class="type-sample">
      <div class="type-heading">${escHtml(brandName)}</div>
      <div class="type-subheading">${escHtml(tagline)}</div>
      <p class="type-body">${escHtml(brandStory || 'Your brand story goes here.')}</p>
      <p class="type-meta">${typography.heading} · ${typography.body} · Weights ${typography.weight}</p>
    </div>
  </div>

  <!-- Brand Voice -->
  <div class="section">
    <p class="section-label">04 · Brand Identity</p>
    <h2>Brand DNA</h2>
    <div class="brand-grid">
      <div class="brand-card">
        <p class="brand-card-label">Brand Voice</p>
        <p class="brand-card-value">${escHtml(brandVoice || '—')}</p>
      </div>
      <div class="brand-card">
        <p class="brand-card-label">Target Audience</p>
        <p class="brand-card-value">${escHtml(targetAudience || '—')}</p>
      </div>
      <div class="brand-card" style="grid-column: 1/-1">
        <p class="brand-card-label">Value Proposition</p>
        <p class="brand-card-value">${escHtml(valueProposition || '—')}</p>
      </div>
    </div>
  </div>

  ${heroImageUrl ? `
  <!-- Hero Image -->
  <div class="section">
    <p class="section-label">05 · Visual Identity</p>
    <h2>Brand Mood</h2>
    <img class="hero-img" src="${heroImageUrl}" alt="${escHtml(brandName)} brand visual">
  </div>
  ` : ''}

  ${canvaLinks ? `
  <!-- Canva Links -->
  <div class="section">
    <p class="section-label">06 · Editable Assets</p>
    <h2>Your Canva Designs</h2>
    <p style="color:#888;font-size:14px;margin-top:8px;margin-bottom:0">Click any link to open and edit your design directly in Canva.</p>
    <div class="canva-links">${canvaLinks}</div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="kit-footer">
    <p>
      ${escHtml(brandName)} Brand Kit · Generated by VisualVault<br>
      Generated on ${new Date(generatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
      This kit is exclusively yours. All assets are editable.
    </p>
  </div>

</div>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return isNaN(r) ? '' : `rgb(${r}, ${g}, ${b})`;
}

module.exports = { generateBrandKitPage };
