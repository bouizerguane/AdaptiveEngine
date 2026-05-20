const pdfFileNameFromUrl = (url) => {
    if (!url) return 'Document PDF';
    try {
        const pathname = new URL(url, window.location.origin).pathname;
        const filename = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
        return filename || 'Document PDF';
    } catch {
        const filename = decodeURIComponent(String(url).split('/').filter(Boolean).pop() || '');
        return filename || 'Document PDF';
    }
};

export const normalizeResourceHtml = (html = '') => {
    if (!html || typeof document === 'undefined') return html || '';

    const template = document.createElement('template');
    template.innerHTML = html;

    const buildPdfLink = (href, filename) => {
        const safeHref = href || '#';
        const label = filename || pdfFileNameFromUrl(safeHref);
        const wrapper = document.createElement('div');
        wrapper.className = 'my-4 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm';
        wrapper.setAttribute('data-type', 'pdf-resource');
        wrapper.setAttribute('data-filename', label);
        const title = document.createElement('p');
        title.className = 'mb-2 text-sm font-semibold text-slate-700';
        title.textContent = label;
        const link = document.createElement('a');
        link.href = safeHref;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700 underline hover:bg-indigo-50';
        link.textContent = 'Ouvrir le document PDF';
        wrapper.append(title, link);
        return wrapper;
    };

    template.content.querySelectorAll('div[data-type="pdf-resource"]').forEach((node) => {
        const href = node.querySelector('a[href]')?.getAttribute('href')
            || node.querySelector('object')?.getAttribute('data')
            || node.querySelector('iframe')?.getAttribute('src');
        const filename = node.getAttribute('data-filename') || node.querySelector('a[href]')?.textContent?.trim() || pdfFileNameFromUrl(href);
        node.replaceWith(buildPdfLink(href, filename));
    });

    template.content.querySelectorAll('object[type="application/pdf"], object[data-type="pdf"], iframe[data-type="pdf"]').forEach((node) => {
        if (node.closest('div[data-type="pdf-resource"]')) return;
        const href = node.getAttribute('data') || node.getAttribute('src');
        const filename = node.getAttribute('data-filename') || pdfFileNameFromUrl(href);
        node.replaceWith(buildPdfLink(href, filename));
    });

    return template.innerHTML;
};
