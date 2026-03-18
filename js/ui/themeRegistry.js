export const themes = [
    {
        id: 'space',
        label: 'Space',
        shortLabel: 'Orbit',
        description: 'Deep navy surfaces with cosmic glow and cooler contrast.',
        metaColor: '#0b1120'
    },
    {
        id: 'green',
        label: 'Green',
        shortLabel: 'Canopy',
        description: 'Dense emerald gradients with organic highlights and richer depth.',
        metaColor: '#06130d'
    },
    {
        id: 'frutiger-aero',
        label: 'Frutiger Aero',
        shortLabel: 'Aero',
        description: 'Glossy cyan-green glass with brighter, airy atmospheric color.',
        metaColor: '#bfeff7'
    },
    {
        id: 'sunshine',
        label: 'Sunshine',
        shortLabel: 'Breeze',
        description: 'Warm sunset glass with coral light, sea-breeze blue, and brighter contrast.',
        metaColor: '#fff2e4'
    }
];

export const DEFAULT_THEME = themes.find((theme) => theme.id === 'space') || themes[0];

export const getThemeById = (themeId) => {
    return themes.find((theme) => theme.id === themeId) || DEFAULT_THEME;
};
