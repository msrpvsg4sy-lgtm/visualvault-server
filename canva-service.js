/**
 * canva-service.js
 *
 * Crée et organise les designs Canva pour chaque client.
 *
 * Stratégie sans templates pré-faits :
 *  - Canva Autofill API : injecte le logo (SVG uploadé) + données de marque
 *    dans 5 templates universels (un par format, aucun rapport au secteur)
 *  - Les templates universels sont des layouts vierges avec des champs
 *    nommés : "Brand Name", "Tagline", "Brand Voice", "Logo"
 *
 * Setup unique requis :
 *  Créer 5 templates dans ton compte Canva et noter leurs IDs dans .env
 *  (guide inclus à la fin de ce fichier).
 */

const https = require('https');
const http  = require('http');   // FIX: signed URLs can be http or https

class CanvaService {
  constructor(accessToken) {
    if (!accessToken) throw new Error('CanvaService: CANVA_ACCESS_TOKEN is missing in environment');
    this.token = accessToken;
    // IDs des 5 templates universels (configurés dans .env)
    this.templates = {
      logo:          process.env.CANVA_TPL_LOGO,
      instagram:     process.env.CANVA_TPL_INSTAGRAM,
      story:         process.env.CANVA_TPL_STORY,
      business_card: process.env.CANVA_TPL_BUSINESS_CARD,
      email_header:  process.env.CANVA_TPL_EMAIL_HEADER,
    };
  }

  // ── Requête HTTP générique ────────────────────────────────────────────────

  _req(method, endpoint, body = null, isFormData = false) {
    return new Promise((resolve, reject) => {
      const payload = body && !isFormData ? JSON.stringify(body) : body;
      const headers = {
        Authorization: `Bearer ${this.token}`,
      };
      if (!isFormData) headers['Content-Type'] = 'application/json';
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

      const opts = {
        hostname: 'api.canva.com',
        path: `/rest/v1${endpoint}`,
        method,
        headers,
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) reject(new Error(`Canva ${res.statusCode}: ${JSON.stringify(parsed)}`));
            else resolve(parsed);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  _poll(getStatus, interval = 2000, maxTries = 30) {
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < maxTries; i++) {
        await new Promise((r) => setTimeout(r, interval));
        try {
          const result = await getStatus();
          if (result) return resolve(result);
        } catch (e) { return reject(e); }
      }
      reject(new Error('Polling timeout'));
    });
  }

  // ── Upload d'un SVG logo ──────────────────────────────────────────────────

  /**
   * Uploade un logo SVG dans Canva et retourne l'asset ID.
   * Utilise l'API d'upload multipart.
   * @param {string} svgContent  Code SVG brut
   * @param {string} name        Nom de l'asset
   * @returns {Promise<string>}  Asset ID Canva
   */
  async uploadLogoSvg(svgContent, name) {
    // Étape 1 : créer un job d'upload
    const { job } = await this._req('POST', '/asset-uploads', {
      name,
      mime_type: 'image/svg+xml',
    });

    // Étape 2 : uploader le contenu vers l'URL signée retournée
    const uploadUrl = job.upload_url;
    await this._uploadToSignedUrl(uploadUrl, Buffer.from(svgContent, 'utf-8'), 'image/svg+xml');

    // Étape 3 : polling jusqu'à ce que l'upload soit traité
    const asset = await this._poll(async () => {
      const status = await this._req('GET', `/asset-uploads/${job.id}`);
      if (status.job?.status === 'success') return status.job.asset;
      if (status.job?.status === 'failed') throw new Error('Asset upload failed');
      return null;
    });

    return asset.id;
  }

  /**
   * Upload une image depuis une URL externe (ex: DALL-E 3 URL) vers Canva.
   * FIX: Canva asset-uploads n'a pas de champ import_url —
   *      on télécharge d'abord l'image, puis on l'uploade via URL signée.
   */
  async uploadImageFromUrl(imageUrl, name) {
    // 1. Télécharger l'image en mémoire
    const { buffer, mimeType } = await this._downloadUrl(imageUrl);

    // 2. Créer un job d'upload avec le bon mime type
    const { job } = await this._req('POST', '/asset-uploads', {
      name,
      mime_type: mimeType,
    });

    // 3. PUT vers l'URL signée
    await this._uploadToSignedUrl(job.upload_url, buffer, mimeType);

    // 4. Polling
    const asset = await this._poll(async () => {
      const status = await this._req('GET', `/asset-uploads/${job.id}`);
      if (status.job?.status === 'success') return status.job.asset;
      if (status.job?.status === 'failed') throw new Error('Asset upload from URL failed');
      return null;
    });

    return asset.id;
  }

  /** Télécharge une URL et retourne { buffer, mimeType } */
  _downloadUrl(url) {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this._downloadUrl(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          buffer:   Buffer.concat(chunks),
          mimeType: res.headers['content-type']?.split(';')[0] || 'image/png',
        }));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  _uploadToSignedUrl(url, buffer, mimeType) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      // FIX: choisir http ou https selon le protocole de l'URL signée
      const mod = parsedUrl.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsedUrl.hostname,
        path:     parsedUrl.pathname + parsedUrl.search,
        method:   'PUT',
        headers: {
          'Content-Type':   mimeType,
          'Content-Length': buffer.length,
        },
      };
      const req = mod.request(opts, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Signed URL upload failed: HTTP ${res.statusCode}`));
          } else {
            resolve();
          }
        });
      });
      req.on('error', reject);
      req.write(buffer);
      req.end();
    });
  }

  // ── Autofill d'un template ────────────────────────────────────────────────

  /**
   * Remplit un template Canva avec les données de marque.
   *
   * Champs attendus dans le template Canva :
   *   "Brand Name"  → text
   *   "Tagline"     → text
   *   "Brand Voice" → text
   *   "Logo"        → image (optionnel, si le template a un champ image)
   *
   * @param {string} templateId
   * @param {object} identity    Objet BrandIdentity complet
   * @param {string} logoAssetId Asset ID du logo uploadé
   * @param {string} title       Titre du design généré
   */
  async autofillTemplate(templateId, identity, logoAssetId, title) {
    const dataFields = [
      { name: 'Brand Name', type: 'text',  text:  { text: identity.brandName } },
      { name: 'Tagline',    type: 'text',  text:  { text: identity.tagline } },
      { name: 'Brand Voice',type: 'text',  text:  { text: identity.brandVoice } },
    ];

    if (logoAssetId) {
      dataFields.push({
        name: 'Logo',
        type: 'image',
        image: { type: 'asset', asset_id: logoAssetId },
      });
    }

    const { job } = await this._req('POST', '/autofills', {
      design_id: templateId,
      title,
      data: dataFields,
    });

    // Polling
    const design = await this._poll(async () => {
      const status = await this._req('GET', `/autofills/${job.id}`);
      if (status.job?.status === 'success') return status.job.result?.design;
      if (status.job?.status === 'failed') throw new Error(`Autofill failed for "${title}"`);
      return null;
    }, 3000, 20);

    return design;
  }

  // ── Dossier client ────────────────────────────────────────────────────────

  async createFolder(name) {
    const { folder } = await this._req('POST', '/folders', {
      name,
      parent_folder_id: 'root',
    });
    return folder;
  }

  async moveToFolder(designId, folderId) {
    await this._req('POST', `/folders/${folderId}/items`, { item_id: designId });
  }

  // ── Partage ───────────────────────────────────────────────────────────────

  async shareDesignWithEmail(designId, email) {
    return this._req('POST', `/designs/${designId}/permissions`, {
      user_email: email,
      access_level: 'edit',
    });
  }

  async getDesignEditUrl(designId) {
    const { design } = await this._req('GET', `/designs/${designId}`);
    return design?.urls?.edit_url;
  }

  // ── Export PDF ────────────────────────────────────────────────────────────

  async exportDesignAsPdf(designId) {
    const { job } = await this._req('POST', '/exports', {
      design_id: designId,
      format: 'pdf',
      export_quality: 'pro',
    });

    const pdfUrl = await this._poll(async () => {
      const status = await this._req('GET', `/exports/${job.id}`);
      if (status.job?.status === 'success') return status.job.urls?.[0];
      if (status.job?.status === 'failed') throw new Error('PDF export failed');
      return null;
    }, 3000, 30);

    return pdfUrl;
  }

  // ── Orchestration complète ────────────────────────────────────────────────

  /**
   * Génère tous les assets Canva pour un client et les livre.
   *
   * @param {object} identity   Résultat de brand-engine.js
   * @param {string} email      Email du client
   * @returns {{ editUrls: object, folderId: string }}
   */
  async createClientKit(identity, email) {
    const { brandName, logoSvg, heroImageUrl } = identity;
    const kitLabel = `${brandName} – Brand Kit`;

    console.log(`[Canva] Creating kit for "${brandName}"`);

    // 1. Uploader le logo SVG
    const logoAssetId = logoSvg
      ? await this.uploadLogoSvg(logoSvg, `${brandName} – Logo`).catch((e) => {
          console.warn('[Canva] SVG upload failed:', e.message);
          return null;
        })
      : null;

    // 2. Uploader l'image hero DALL-E (si disponible)
    const heroAssetId = heroImageUrl
      ? await this.uploadImageFromUrl(heroImageUrl, `${brandName} – Hero`).catch((e) => {
          console.warn('[Canva] Hero upload failed:', e.message);
          return null;
        })
      : null;

    // 3. Autofill de tous les templates en parallèle
    const templateJobs = Object.entries(this.templates)
      .filter(([, id]) => !!id)   // ignorer les templates non configurés
      .map(([format, templateId]) =>
        this.autofillTemplate(
          templateId,
          identity,
          format === 'logo' ? logoAssetId : (logoAssetId || heroAssetId),
          `${brandName} – ${format.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`
        ).then((design) => ({ format, design }))
          .catch((err) => {
            console.warn(`[Canva] Autofill failed for ${format}:`, err.message);
            return null;
          })
      );

    const results = (await Promise.all(templateJobs)).filter(Boolean);

    // 4. Créer le dossier client
    const folder = await this.createFolder(kitLabel);

    // 5. Déplacer tous les designs dans le dossier
    for (const { design } of results) {
      await this.moveToFolder(design.id, folder.id).catch(() => {});
    }

    // 6. Partager le dossier avec le client
    const editUrls = {};
    for (const { format, design } of results) {
      try {
        await this.shareDesignWithEmail(design.id, email);
        editUrls[format] = design.urls?.edit_url;
      } catch (e) {
        console.warn(`[Canva] Share failed for ${format}:`, e.message);
      }
    }

    console.log(`[Canva] Kit created ✓ — ${results.length} designs, folder: ${folder.id}`);
    return { editUrls, folderId: folder.id, logoAssetId };
  }
}

module.exports = CanvaService;

/* ─────────────────────────────────────────────────────────────────────────────
   SETUP DES 5 TEMPLATES UNIVERSELS

   Crée ces 5 designs dans ton compte Canva, puis ajoute leurs IDs dans .env.
   Chaque template doit avoir des "champs de données" (data fields) nommés :
     - "Brand Name"   (text)
     - "Tagline"      (text)
     - "Brand Voice"  (text)
     - "Logo"         (image, optionnel)

   Pour créer un champ de données dans Canva :
   Elements → clic sur l'élément texte → ⋮ → "Connect data field" → nommer le champ

   Formats à créer :
   ┌─────────────────────────────────────────────────────┐
   │ Format          │ Taille Canva    │ ENV var          │
   ├─────────────────────────────────────────────────────┤
   │ Logo            │ 800 × 800 px    │ CANVA_TPL_LOGO   │
   │ Instagram post  │ 1080 × 1350 px  │ CANVA_TPL_INSTAGRAM │
   │ Story/Reel      │ 1080 × 1920 px  │ CANVA_TPL_STORY  │
   │ Business card   │ 3.5" × 2"       │ CANVA_TPL_BUSINESS_CARD │
   │ Email header    │ 600 × 200 px    │ CANVA_TPL_EMAIL_HEADER  │
   └─────────────────────────────────────────────────────┘

   Récupérer l'ID d'un design : ouvrir le design dans Canva →
   URL = https://www.canva.com/design/DESIGN_ID/... → copier DESIGN_ID
────────────────────────────────────────────────────────────────────────────── */
