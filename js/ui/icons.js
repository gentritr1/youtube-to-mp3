const ICONS = {
    bolt: '<path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z"></path>',
    sliders: '<path d="M4 7h10"></path><path d="M18 7h2"></path><circle cx="16" cy="7" r="2"></circle><path d="M4 17h2"></path><path d="M10 17h10"></path><circle cx="8" cy="17" r="2"></circle>',
    snake: '<path d="M8 5h5a4 4 0 0 1 0 8h-3a3 3 0 0 0 0 6h6"></path><path d="M16 19h2"></path><circle cx="8" cy="5" r="1"></circle>',
    music: '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    ruler: '<path d="M4 19 19 4l1 5-11 11-5-1Z"></path><path d="m7 16 2 2"></path><path d="m10 13 2 2"></path><path d="m13 10 2 2"></path>',
    flame: '<path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-4-7 .2 2-1 3-2 4 0-4-2-7-5-9 .6 4-3 6-3 11a7 7 0 0 0 7 8Z"></path>',
    ghost: '<path d="M5 21V10a7 7 0 0 1 14 0v11l-3-2-2 2-2-2-2 2-2-2-3 2Z"></path><circle cx="9" cy="10" r="1"></circle><circle cx="15" cy="10" r="1"></circle>',
    scissors: '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="m8.5 8.5 11 11"></path><path d="m8.5 15.5 11-11"></path>',
    globe: '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a14 14 0 0 1 0 18"></path><path d="M12 3a14 14 0 0 0 0 18"></path>',
    mic: '<path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4Z"></path><path d="M19 10a7 7 0 0 1-14 0"></path><path d="M12 17v4"></path><path d="M8 21h8"></path>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5Z"></path><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z"></path>',
    equalizer: '<path d="M4 21V10"></path><path d="M12 21V3"></path><path d="M20 21v-7"></path><path d="M2 10h4"></path><path d="M10 7h4"></path><path d="M18 14h4"></path>',
    guitar: '<path d="m14 4 6 6"></path><path d="m16 2 6 6"></path><path d="M12 8 4 16a4 4 0 1 0 4 4l8-8"></path><circle cx="7" cy="19" r="1.5"></circle>',
    cup: '<path d="M5 4h11v8a5.5 5.5 0 0 1-11 0V4Z"></path><path d="M16 7h2a3 3 0 0 1 0 6h-2"></path><path d="M4 21h14"></path>',
    timer: '<path d="M10 2h4"></path><path d="M12 14v-4"></path><path d="m17 7 1.5-1.5"></path><circle cx="12" cy="14" r="8"></circle>',
    gamepad: '<path d="M6 11h4"></path><path d="M8 9v4"></path><path d="M15 12h.01"></path><path d="M18 10h.01"></path><path d="M17 6H7a5 5 0 0 0-5 5v2a5 5 0 0 0 5 5h1l2-2h4l2 2h1a5 5 0 0 0 5-5v-2a5 5 0 0 0-5-5Z"></path>',
    sparkles: '<path d="M12 3 10 9l-6 2 6 2 2 6 2-6 6-2-6-2-2-6Z"></path><path d="M19 3v4"></path><path d="M21 5h-4"></path>',
    chart: '<path d="M4 19V5"></path><path d="M4 19h16"></path><path d="M8 16v-5"></path><path d="M12 16V8"></path><path d="M16 16v-3"></path>',
    trophy: '<path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"></path><path d="M7 6H4a3 3 0 0 0 3 3"></path><path d="M17 6h3a3 3 0 0 1-3 3"></path>',
    heart: '<path d="M12 21s-7-4.35-9.2-8.55C1.1 9.2 3.1 5.5 6.7 5.5c2 0 3.4 1.1 5.3 3.1 1.9-2 3.3-3.1 5.3-3.1 3.6 0 5.6 3.7 3.9 6.95C19 16.65 12 21 12 21Z" fill="currentColor"></path>',
    'heart-empty': '<path d="M12 21s-7-4.35-9.2-8.55C1.1 9.2 3.1 5.5 6.7 5.5c2 0 3.4 1.1 5.3 3.1 1.9-2 3.3-3.1 5.3-3.1 3.6 0 5.6 3.7 3.9 6.95C19 16.65 12 21 12 21Z"></path>',
    alert: '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path>'
};

const ALIASES = {
    '\u26A1': 'bolt',
    '\u{1F39A}\uFE0F': 'sliders',
    '\u{1F39A}': 'sliders',
    '\u{1F40D}': 'snake',
    '\u{1F3B5}': 'music',
    '\u{1F4CF}': 'ruler',
    '\u{1F525}': 'flame',
    '\u{1F47B}': 'ghost',
    '\u2702\uFE0F': 'scissors',
    '\u2702': 'scissors',
    '\u{1F30D}': 'globe',
    '\u{1F3A4}': 'mic',
    '\u{1F3A7}': 'headphones',
    '\u{1F39B}\uFE0F': 'equalizer',
    '\u{1F39B}': 'equalizer',
    '\u{1F3B8}': 'guitar',
    '\u2615': 'cup',
    '\u26A0\uFE0F': 'alert',
    '\u26A0': 'alert'
};

const FALLBACK_ICON = 'music';

export const resolveIconName = (name) => {
    const key = String(name || '').trim();
    return ICONS[key] ? key : (ALIASES[key] || FALLBACK_ICON);
};

export const iconSvg = (name, className = 'ui-icon') => {
    const iconName = resolveIconName(name);
    const safeClassName = String(className || 'ui-icon')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');

    return `<svg class="${safeClassName}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[iconName]}</svg>`;
};

export const setIcon = (element, name, className = 'ui-icon') => {
    if (!element) return;
    element.innerHTML = iconSvg(name, className);
};

export const hydrateIcons = (root = document) => {
    root.querySelectorAll('[data-ui-icon]').forEach((element) => {
        setIcon(element, element.dataset.uiIcon, element.dataset.uiIconClass || 'ui-icon');
    });
};
