export function unwrapPage(res, { page = 1, limit = 10, search = '' } = {}) {
    if (Array.isArray(res)) {
        const term = search.trim().toLowerCase();
        const filtered = term
            ? res.filter((i) => typeof i.nome === 'string' && i.nome.toLowerCase().includes(term))
            : res;
        return {
            items: filtered.slice((page - 1) * limit, page * limit),
            total: filtered.length,
            totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        };
    }
    const items = res?.items ?? res?.data ?? [];
    const total = res?.total ?? items.length;
    return {
        items,
        total,
        totalPages: res?.totalPages ?? Math.max(1, Math.ceil(total / limit)),
    };
}

/** 1 … 4 5 6 … 29: sempre primeira, última e vizinhas da página atual. */
export function getPageItems(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const wanted = new Set([1, total, current - 1, current, current + 1]);
    const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…', p] : [p]));
}


export const isDataDesconhecida = (d) => !d || d === '10/10/1000';

export const formatDataAdmin = (date) => (isDataDesconhecida(date) ? 'Não informada' : date);
