const sanitizeFileName = (value) => String(value || 'qr-code')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'qr-code';

export const qrFileName = sanitizeFileName;

export async function svgToRasterBlob(svgNode, format = 'png', size = 720) {
    if (!svgNode) throw new Error('QR Code não encontrado.');

    const svg = svgNode.cloneNode(true);
    const viewBox = svg.viewBox?.baseVal;
    const sourceWidth = viewBox?.width || Number(svg.getAttribute('width')) || 200;
    const sourceHeight = viewBox?.height || Number(svg.getAttribute('height')) || sourceWidth;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(sourceWidth));
    svg.setAttribute('height', String(sourceHeight));

    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {
        type: 'image/svg+xml;charset=utf-8',
    }));

    try {
        const image = new Image();
        image.src = source;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a imagem.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size, size);
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, size, size);

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Falha ao gerar a imagem.')), mimeType, 0.96);
        });
        return blob;
    } finally {
        URL.revokeObjectURL(source);
    }
}

export async function svgToLabeledRasterBlob(svgNode, title, subtitle = '', size = 720, signal, onProgress) {
    if (!svgNode) throw new Error('QR Code não encontrado.');

    const svg = svgNode.cloneNode(true);
    const viewBox = svg.viewBox?.baseVal;
    const sourceWidth = viewBox?.width || Number(svg.getAttribute('width')) || 200;
    const sourceHeight = viewBox?.height || Number(svg.getAttribute('height')) || sourceWidth;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(sourceWidth));
    svg.setAttribute('height', String(sourceHeight));

    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {
        type: 'image/svg+xml;charset=utf-8',
    }));

    try {
        const image = new Image();
        image.src = source;
        await image.decode();
        if (signal?.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
        onProgress?.(1, 3);

        const padding = 60;
        const width = size + padding * 2;
        const lineLimit = width - padding * 2;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a imagem.');

        const wrapText = (text, font) => {
            if (!text) return [];
            context.font = font;
            const lines = [];
            let line = '';
            String(text).split(/\s+/).forEach((word) => {
                const candidate = line ? `${line} ${word}` : word;
                if (line && context.measureText(candidate).width > lineLimit) {
                    lines.push(line);
                    line = word;
                } else {
                    line = candidate;
                }
            });
            if (line) lines.push(line);
            return lines;
        };

        const titleFont = '700 34px Arial, sans-serif';
        const subtitleFont = '22px Arial, sans-serif';
        const titleLines = wrapText(title, titleFont);
        const subtitleLines = wrapText(subtitle, subtitleFont);
        const titleLineHeight = 42;
        const subtitleLineHeight = 30;
        const topPadding = 48;
        const titleHeight = titleLines.length * titleLineHeight;
        const subtitleGap = subtitleLines.length ? 12 : 0;
        const qrGap = 26;
        const qrTop = topPadding + titleHeight + subtitleGap + subtitleLines.length * subtitleLineHeight + qrGap;

        canvas.width = width;
        canvas.height = qrTop + size + padding;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.textAlign = 'center';
        context.textBaseline = 'top';
        context.fillStyle = '#000000';
        context.font = titleFont;
        titleLines.forEach((line, index) => context.fillText(line, width / 2, topPadding + index * titleLineHeight));

        context.fillStyle = '#334155';
        context.font = subtitleFont;
        subtitleLines.forEach((line, index) => context.fillText(line, width / 2, topPadding + titleHeight + subtitleGap + index * subtitleLineHeight));

        context.imageSmoothingEnabled = false;
        context.drawImage(image, padding, qrTop, size, size);
        onProgress?.(2, 3);

        return await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Falha ao gerar a imagem.'));
                    return;
                }
                onProgress?.(3, 3);
                resolve(blob);
            }, 'image/png');
        });
    } finally {
        URL.revokeObjectURL(source);
    }
}

export function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
    const now = new Date();
    return {
        time: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
        date: ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
    };
}

/* Garante nomes únicos dentro do ZIP: o segundo "joao.png" vira "joao-2.png", e assim por diante. */
function uniqueFileNames(files) {
    const used = new Set();
    return files.map((file) => {
        const dot = file.name.lastIndexOf('.');
        const base = dot > 0 ? file.name.slice(0, dot) : file.name;
        const extension = dot > 0 ? file.name.slice(dot) : '';
        let name = file.name;
        let counter = 1;
        while (used.has(name.toLowerCase())) {
            counter += 1;
            name = `${base}-${counter}${extension}`;
        }
        used.add(name.toLowerCase());
        return name === file.name ? file : { ...file, name };
    });
}

export async function createZipBlob(inputFiles, signal) {
    const files = uniqueFileNames(inputFiles);
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    const dateTime = dosDateTime();
    let localOffset = 0;

    for (const file of files) {
        if (signal?.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
        const name = encoder.encode(file.name);
        const data = new Uint8Array(await file.blob.arrayBuffer());
        if (signal?.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
        const checksum = crc32(data);

        const localHeader = new Uint8Array(30 + name.length);
        const localView = new DataView(localHeader.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, dateTime.time, true);
        localView.setUint16(12, dateTime.date, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, name.length, true);
        localHeader.set(name, 30);
        localParts.push(localHeader, data);

        const centralHeader = new Uint8Array(46 + name.length);
        const centralView = new DataView(centralHeader.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, dateTime.time, true);
        centralView.setUint16(14, dateTime.date, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, data.length, true);
        centralView.setUint16(28, name.length, true);
        centralView.setUint32(42, localOffset, true);
        centralHeader.set(name, 46);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, localOffset, true);

    return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
}

export async function createQrSheetBlob(items, svgNodes, format = 'png', onProgress, signal) {
    const pageWidth = 1240;
    const pageHeight = 1754;
    const margin = 46;
    const gap = 24;
    const columns = 2;
    const rows = 3;
    const cardWidth = (pageWidth - margin * 2 - gap) / columns;
    const cardHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;
    const canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a folha.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageWidth, pageHeight);
    context.textAlign = 'center';
    context.textBaseline = 'top';

    for (let index = 0; index < items.length; index += 1) {
        if (signal?.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = margin + column * (cardWidth + gap);
        const y = margin + row * (cardHeight + gap);
        const item = items[index];
        const name = item.name || item.title || 'QR Code';
        const subtitle = item.subtitle || '';

        context.strokeStyle = '#94a3b8';
        context.lineWidth = 2;
        context.setLineDash([9, 7]);
        context.strokeRect(x, y, cardWidth, cardHeight);
        context.setLineDash([]);
        context.fillStyle = '#102c50';
        context.font = 'bold 28px Arial, sans-serif';
        context.fillText(name, x + cardWidth / 2, y + 32, cardWidth - 36);
        if (subtitle) {
            context.fillStyle = '#475569';
            context.font = '20px Arial, sans-serif';
            context.fillText(subtitle, x + cardWidth / 2, y + 72, cardWidth - 36);
        }

        const svg = svgNodes[index].cloneNode(true);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {
            type: 'image/svg+xml;charset=utf-8',
        });
        const svgUrl = URL.createObjectURL(svgBlob);
        try {
            const image = new Image();
            image.src = svgUrl;
            await image.decode();
            if (signal?.aborted) throw new DOMException('Geração cancelada.', 'AbortError');
            const codeSize = 300;
            context.imageSmoothingEnabled = false;
            context.drawImage(image, x + (cardWidth - codeSize) / 2, y + 150, codeSize, codeSize);
        } finally {
            URL.revokeObjectURL(svgUrl);
        }
        onProgress?.(index + 1, items.length);
    }

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar a folha.')), mimeType, 0.96);
    });
}
