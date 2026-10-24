const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');

const buildUrl = (path, id) => `${PUBLIC_URL}${path}/${encodeURIComponent(id)}`;

export const buildFalecidoUrl = (id) => buildUrl('/falecidos', id);
export const buildQuadraUrl = (id) => buildUrl('/quadra', id);
export const buildLoteUrl = (id) => buildUrl('/lote', id);
