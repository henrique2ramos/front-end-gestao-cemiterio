import { normalizeFalecidoNames, normalizeFalecidoPayload } from './falecidoName';

const API_BASE_URL = import.meta.env.VITE_API_URL;

export function resolveImageUrl(value) {
  if (!value) return '';

  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  return trimmed;
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {}, authToken } = options;

  const config = {
    method,
    headers: { ...headers },
  };

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  if (body instanceof FormData) {
    config.body = body;
  } else if (body !== undefined && body !== null) {
    config.body = JSON.stringify(body);
    config.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config);

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' && data ? data.erro || data.message : data;
    throw new Error(message || 'Erro inesperado ao comunicar com a API.');
  }

  return data;
}

export async function fetchFalecidos({ page, limit } = {}) {
  const params = new URLSearchParams();
  if (page != null) params.set('page', String(page));
  if (limit != null) params.set('limit', String(limit));
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : '';
  const data = await request(`/api/falecidos${query}`);

  if (page != null || limit != null) return normalizeFalecidoNames(data);

  if (Array.isArray(data)) return normalizeFalecidoNames(data);
  if (Array.isArray(data?.items)) return normalizeFalecidoNames(data.items);
  if (Array.isArray(data?.falecidos)) return normalizeFalecidoNames(data.falecidos);
  if (Array.isArray(data?.data)) return normalizeFalecidoNames(data.data);

  console.warn('A API retornou um formato inesperado para a lista de falecidos.');

  return [];
}

export async function fetchFalecidoById(id) {
  return normalizeFalecidoNames(await request(`/api/falecidos/${id}`));
}

export async function fetchFalecidosPorLote(loteId) {
  return normalizeFalecidoNames(await request(`/api/falecidos?loteId=${encodeURIComponent(loteId)}`));
}

export async function fetchFalecidosPorQuadra(quadraId) {
  return normalizeFalecidoNames(await request(`/api/falecidos?quadraId=${encodeURIComponent(quadraId)}`));
}

export async function fetchLote(id) {
  return request(`/api/lotes/${id}`);
}

export async function fetchQuadra(id) {
  return request(`/api/quadras/${id}`);
}

export async function loginAdmin(email, password) {
  return request('/api/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function createFalecido(payload, token) {
  return normalizeFalecidoNames(await request('/api/falecidos', {
    method: 'POST',
    body: normalizeFalecidoPayload(payload),
    authToken: token,
  }));
}

export async function updateFalecido(id, payload, token) {
  return normalizeFalecidoNames(await request(`/api/falecidos/${id}`, {
    method: 'PUT',
    body: normalizeFalecidoPayload(payload),
    authToken: token,
  }));
}

export async function deleteFalecido(id, token) {
  return request(`/api/falecidos/${id}`, {
    method: 'DELETE',
    authToken: token,
  });
}

export async function fetchQuadras() {
  return request('/api/quadras');
}

export async function createQuadra(nome, token) {
  return request('/api/quadras', {
    method: 'POST',
    body: { nome },
    authToken: token,
  });
}

export async function updateQuadra(id, nome, token) {
  return request(`/api/quadras/${id}`, {
    method: 'PUT',
    body: { nome },
    authToken: token,
  });
}

export async function deleteQuadra(id, token) {
  return request(`/api/quadras/${id}`, {
    method: 'DELETE',
    authToken: token,
  });
}

export async function fetchLotes(quadraId, { page, limit } = {}) {
  const params = new URLSearchParams({ quadraId: String(quadraId) });
  if (page != null) params.set('page', String(page));
  if (limit != null) params.set('limit', String(limit));
  return request(`/api/lotes?${params.toString()}`);
}

export async function createLote(quadraId, numero, token) {
  return request('/api/lotes', {
    method: 'POST',
    body: { quadraId, numero },
    authToken: token,
  });
}

export async function createLotesEmSequencia(quadraId, numeroInicial, quantidade, token) {
  return request('/api/lotes', {
    method: 'POST',
    body: { quadraId, numeroInicial, quantidade },
    authToken: token,
  });
}

export async function updateLote(id, numero, token) {
  return request(`/api/lotes/${id}`, {
    method: 'PUT',
    body: { numero },
    authToken: token,
  });
}

export async function deleteLote(id, token) {
  return request(`/api/lotes/${id}`, {
    method: 'DELETE',
    authToken: token,
  });
}
