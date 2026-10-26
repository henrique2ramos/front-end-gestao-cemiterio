const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

export function formatFalecidoName(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;

  return trimmed.split(' ').map((part, index) => {
    // Preserve initials such as J.J.F. instead of turning them into J.j.f.
    if (/^(?:[A-ZÀ-Þ]\.)+[A-ZÀ-Þ]?$/u.test(part)) return part;

    const lower = part.toLocaleLowerCase('pt-BR');
    if (index > 0 && PARTICULAS.has(lower)) return lower;

    return lower.replace(/(^|[-'])(\p{L})/gu, (_, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase('pt-BR')}`
    );
  }).join(' ');
}

export function normalizeFalecidoNames(data) {
  if (Array.isArray(data)) return data.map(normalizeFalecidoNames);
  if (!data || typeof data !== 'object') return data;

  if (typeof data.nome === 'string') {
    return { ...data, nome: formatFalecidoName(data.nome) };
  }

  for (const key of ['falecido', 'items', 'falecidos', 'data']) {
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      return { ...data, [key]: normalizeFalecidoNames(data[key]) };
    }
    if (Array.isArray(data[key])) return { ...data, [key]: data[key].map(normalizeFalecidoNames) };
  }

  return data;
}

export function normalizeFalecidoPayload(payload) {
  if (payload instanceof FormData) {
    const nome = payload.get('nome');
    if (typeof nome === 'string') payload.set('nome', formatFalecidoName(nome));
    return payload;
  }

  if (payload && typeof payload === 'object' && typeof payload.nome === 'string') {
    return { ...payload, nome: formatFalecidoName(payload.nome) };
  }

  return payload;
}
