/**
 * email-service.js
 *
 * Envoie l'email de livraison du brand kit au client.
 * La page HTML brand kit est envoyée en pièce jointe ET en prévisualisation inline.
 *
 * Lib : Resend (npm install resend)
 * Compte gratuit : https://resend.com (100 emails/jour)
 */

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * @param {object} params
 * @param {string} params.customerEmail
 * @param {string} params.customerName
 * @param {object} params.identity         Résultat complet de brand-engine.js
 * @param {object} params.canvaEditUrls    { logo, instagram, story, business_card, email_header }
 * @param {string} params.kitHtml          Page HTML brand kit complète
 */
async function sendDeliveryEmail({ customerEmail, customerName, identity, canvaEditUrls, kitHtml }) {
  const { brandName, tagline, sector, style, palette, typography, brandVoice } = identity;
  const firstName = customerName?.split(' ')[0] || 'there';

  // Liens Canva formatés pour l'email
  const canvaLinksHtml = Object.entries(canvaEditUrls || {})
    .filter(([, url]) => !!url)
    .map(([format, url]) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
          <a href="${url}" style="color: ${palette.primary}; font-weight: 600; text-decoration: none; font-size: 14px;">
            ✦ ${format.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} →
          </a>
        </td>
      </tr>
    `).join('');

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.1);">

  <!-- Header coloré -->
  <tr>
    <td style="background:${palette.primary};padding:48px 48px 40px;text-align:center;">
      <p style="margin:0 0 8px;color:${contrastColor(palette.primary)};font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;">
        VisualVault · Brand Kit Ready
      </p>
      <h1 style="margin:0 0 12px;color:${contrastColor(palette.primary)};font-size:36px;font-weight:700;line-height:1.1;">
        ${esc(brandName)}
      </h1>
      <p style="margin:0;color:${contrastColor(palette.primary)};font-size:16px;opacity:0.8;font-weight:300;">
        ${esc(tagline)}
      </p>
    </td>
  </tr>

  <!-- Body -->
  <tr><td style="padding:40px 48px;">

    <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
      Hi ${esc(firstName)},
    </p>
    <p style="margin:0 0 32px;color:#333;font-size:15px;line-height:1.7;">
      Your <strong>${esc(brandName)}</strong> brand identity is ready — generated just for you.
      <strong>${esc(sector)}</strong> sector · <strong>${esc(style)}</strong> style.
    </p>

    <!-- Palette -->
    <p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;">Your Colors</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        ${Object.values(palette).map((hex) => `
          <td style="padding-right:8px;">
            <div style="width:40px;height:40px;border-radius:8px;background:${hex};border:1px solid rgba(0,0,0,0.08);"></div>
            <div style="font-size:9px;color:#aaa;text-align:center;margin-top:4px;font-family:monospace;">${hex}</div>
          </td>
        `).join('')}
      </tr>
    </table>

    <!-- Fonts -->
    <p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;">Typography</p>
    <p style="margin:0 0 32px;color:#444;font-size:14px;">
      <strong>${esc(typography.heading)}</strong> for headings &nbsp;·&nbsp;
      <strong>${esc(typography.body)}</strong> for body text
    </p>

    <!-- Brand voice -->
    <div style="background:#f9f9f9;border-radius:10px;padding:20px 24px;margin-bottom:32px;border-left:3px solid ${palette.primary}">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;">Brand Voice</p>
      <p style="margin:0;color:#222;font-size:15px;font-style:italic;">"${esc(brandVoice)}"</p>
    </div>

    <!-- Canva links -->
    ${canvaLinksHtml ? `
    <p style="margin:0 0 16px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;">Your Editable Designs in Canva</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      ${canvaLinksHtml}
    </table>
    ` : ''}

    <!-- CTA brand kit page -->
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
      <tr>
        <td style="background:#111;border-radius:10px;padding:16px 36px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;opacity:0.6;">Included in this email</p>
          <p style="margin:0;color:#fff;font-size:15px;font-weight:600;">Your full brand kit page is attached below ↓</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#666;font-size:14px;line-height:1.7;">
      Questions? Reply to this email — we're here to help.<br><br>
      Best,<br>
      <strong>The VisualVault Team</strong>
    </p>

  </td></tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f4f4f4;padding:24px 48px;text-align:center;border-top:1px solid #e8e8e8;">
      <p style="margin:0;color:#aaa;font-size:11px;line-height:1.8;">
        VisualVault · Brand Identity Kits<br>
        <a href="mailto:${process.env.FROM_EMAIL}" style="color:#aaa;">Support</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: `VisualVault <${process.env.FROM_EMAIL}>`,
    to:   [customerEmail],
    subject: `✦ Your ${brandName} Brand Kit is Ready`,
    html:    emailHtml,
    // La page brand kit en pièce jointe HTML
    attachments: kitHtml ? [
      {
        filename: `${brandName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-brand-kit.html`,
        content:  Buffer.from(kitHtml, 'utf-8').toString('base64'),
      },
    ] : [],
  });

  if (error) throw new Error(`Email failed: ${JSON.stringify(error)}`);
  return data;
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function contrastColor(hex) {
  // Noir ou blanc selon la luminosité de la couleur de fond
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#111111' : '#FFFFFF';
}

module.exports = { sendDeliveryEmail };
