export const THEME_STORAGE_KEY = 'pedidoFlowTheme';

export const THEMES = [
  {
    key: 'emerald',
    name: 'Verde PedidoFlow',
    description: 'Tema padrão com destaque em verde.',
    preview: {
      accent: '#00d084',
      bg: '#1a2332',
      surface: '#111827',
      border: '#374151',
    },
  },
  {
    key: 'black',
    name: 'Black',
    description: 'Contraste máximo com detalhes sutis.',
    preview: {
      accent: '#00d084',
      bg: '#0a0a0a',
      surface: '#111111',
      border: '#222222',
    },
  },
  {
    key: 'white',
    name: 'White',
    description: 'Tema claro com alto brilho.',
    preview: {
      accent: '#ff7a00',
      bg: '#f7f7f7',
      surface: '#ffffff',
      border: '#e5e5e5',
    },
  },
  {
    key: 'safira',
    name: 'Azul Safira',
    description: 'Azuis profundos e contraste frio.',
    preview: {
      accent: '#3b82f6',
      bg: '#0f172a',
      surface: '#111827',
      border: '#1f2937',
    },
  },
  {
    key: 'sunset',
    name: 'Pôr do Sol',
    description: 'Tons quentes e vibrantes.',
    preview: {
      accent: '#ff7a00',
      bg: '#2b1c17',
      surface: '#3b251c',
      border: '#513127',
    },
  },
  {
    key: 'violeta',
    name: 'Violeta Noturno',
    description: 'Roxo elegante com contraste suave.',
    preview: {
      accent: '#a855f7',
      bg: '#1c1630',
      surface: '#241a3d',
      border: '#3a2a5c',
    },
  },
  {
    key: 'graphite',
    name: 'Graphite Aqua',
    description: 'Grafite profundo com acento aqua elegante.',
    preview: {
      accent: '#4dd0e1',
      bg: '#0f1115',
      surface: '#141a22',
      border: '#263142',
    },
  },
  {
    key: 'rose',
    name: 'Rose Noir',
    description: 'Fundo escuro com rose sofisticado.',
    preview: {
      accent: '#f472b6',
      bg: '#16131a',
      surface: '#1b1722',
      border: '#3a2e43',
    },
  },
  {
    key: 'sage',
    name: 'Sage Stone',
    description: 'Verdes suaves com tom mineral.',
    preview: {
      accent: '#a3b18a',
      bg: '#141714',
      surface: '#191d19',
      border: '#323a32',
    },
  },
  {
    key: 'copper',
    name: 'Copper Night',
    description: 'Cobre moderno em base noturna.',
    preview: {
      accent: '#e07a5f',
      bg: '#1a1411',
      surface: '#201714',
      border: '#3b2d26',
    },
  },
];

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'emerald';
  return window.localStorage.getItem(THEME_STORAGE_KEY) || 'emerald';
};

export const applyTheme = (themeKey) => {
  if (typeof window === 'undefined') return;
  const next = THEMES.find((theme) => theme.key === themeKey)?.key || 'emerald';
  document.documentElement.setAttribute('data-theme', next);
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
};
