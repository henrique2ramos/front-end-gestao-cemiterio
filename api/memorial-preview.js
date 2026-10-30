const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const unwrapRecord = (payload) => payload?.falecido || payload?.item || payload?.data || payload;

const resolvePublicImage = (value, apiBase, siteOrigin) => {
  if (typeof value !== 'string' || !value.trim() || value.startsWith('data:')) return `${siteOrigin}/favicon.svg`;
  try {
    return new URL(value.trim(), value.startsWith('/uploads/') ? apiBase : siteOrigin).href;
  } catch {
    return `${siteOrigin}/favicon.svg`;
  }
};

export default async function handler(request, response) {
  const id = String(request.query?.id || '').trim();
  const host = request.headers['x-forwarded-host'] || request.headers.host || '';
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const siteOrigin = `${protocol}://${host}`;
  const previewVersion = String(request.query?.preview || '').trim();
  const canonicalUrl = `${siteOrigin}/falecidos/${encodeURIComponent(id)}${previewVersion ? `?preview=${encodeURIComponent(previewVersion)}` : ''}`;
  const runtimeEnv = globalThis.process?.env || {};
  const apiBaseValue = runtimeEnv.VITE_API_URL || runtimeEnv.API_BASE_URL || '';

  let name = 'Memorial Digital Pirpirituba';
  let description = 'Acesse o memorial digital desta pessoa em Pirpirituba.';
  let image = `${siteOrigin}/favicon.svg`;

  if (id && apiBaseValue) {
    try {
      const apiBase = new URL(apiBaseValue);
      const apiUrl = new URL(`/api/falecidos/${encodeURIComponent(id)}`, apiBase);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);
      const apiResponse = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (apiResponse.ok) {
        const record = unwrapRecord(await apiResponse.json());
        name = String(record?.nome || name);
        description = `Acesse o memorial digital de ${name} em Pirpirituba.`;
        image = resolvePublicImage(record?.imagem, apiBase, siteOrigin);
      }
    } catch (error) {
      console.error('Não foi possível gerar a prévia pública do memorial:', error);
    }
  }

  const title = `${name} | Memorial Digital Pirpirituba`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonicalUrl)}"><meta property="og:type" content="article"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="Fotografia de ${escapeHtml(name)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"></head><body><h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p><a href="${escapeHtml(canonicalUrl)}">Abrir memorial</a></body></html>`;

  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.setHeader('Vary', 'User-Agent');
  response.status(200).send(html);
}
