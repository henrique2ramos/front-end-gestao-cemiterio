const configuredUrl = String(import.meta.env.VITE_PUBLIC_URL || '').trim().replace(/\/+$/, '');
const PUBLIC_URL = configuredUrl || window.location.origin;

const buildUrl = (path, id) => `${PUBLIC_URL}${path}/${encodeURIComponent(id)}`;

export const buildFalecidoUrl = (id) => buildUrl('/falecidos', id);
export const buildQuadraUrl = (id) => buildUrl('/quadra', id);
export const buildLoteUrl = (id) => buildUrl('/lote', id);

/* Informa para onde os QR Codes vão apontar e se esse endereço é seguro para imprimir.
   severe = true quando a placa ficaria inutilizável (endereço local ou inválido). */
export function getQrBaseInfo() {
    let host = '';
    let protocol = '';
    try {
        const parsed = new URL(PUBLIC_URL);
        host = parsed.hostname;
        protocol = parsed.protocol;
    } catch {
        // URL inválida: host continua vazio e o aviso abaixo é exibido
    }

    const isLocal = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
        || host === '::1' || host === '[::1]' || host.endsWith('.local');

    let warning = '';
    let severe = false;
    if (!host) {
        warning = 'O endereço definido em VITE_PUBLIC_URL não é uma URL válida.';
        severe = true;
    } else if (isLocal) {
        warning = 'Este endereço só funciona neste computador ou nesta rede. As placas impressas assim não vão abrir para os visitantes.';
        severe = true;
    } else if (protocol === 'http:') {
        warning = 'O endereço não usa HTTPS; alguns celulares mostram aviso de site inseguro ao abrir o QR Code.';
    } else if (!configuredUrl) {
        warning = 'VITE_PUBLIC_URL não está definida: os QR Codes usam o endereço em que este painel está aberto.';
    } else if (host.endsWith('.vercel.app')) {
        warning = 'Este parece ser um endereço de teste (vercel.app). Confirme que ele será o endereço definitivo do site antes de imprimir.';
    }

    return { url: PUBLIC_URL, configured: Boolean(configuredUrl), warning, severe };
}