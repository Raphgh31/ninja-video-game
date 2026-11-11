// Palette de la Forêt (chapitre 2) : verts émeraude profonds, bruns terreux,
// pierre gris-bleu, turquoise pour l'eau et les lueurs, or pour les rais de
// lumière. Chaque matière a sa rampe, de l'ombre (index 0) à la lumière.
// Le soleil vient du haut à gauche, comme partout dans le jeu.

export const BARK = ['#24120b', '#3d2314', '#57301c', '#75402a', '#955636', '#b47246'];   // écorce rousse
export const BARK_DARK = ['#170d0a', '#26160f', '#382116', '#4b2e1e', '#613d28'];          // troncs dans l'ombre
export const MOSS = ['#16402f', '#1b4d3e', '#23693f', '#2e8b57', '#4fae4e', '#83cf4c', '#bfe866'];
export const LEAF = ['#0f2e26', '#16402f', '#1b4d3e', '#23694a', '#2e8b57', '#55ae54', '#8fd058'];
export const FERN = ['#123a28', '#1a5232', '#27713a', '#3f9641', '#68bb47', '#a3dd58'];
export const PINE = ['#0d2622', '#12352c', '#184636', '#205a40', '#2d7149', '#458c52'];   // conifères proches
export const HUMUS = ['#150c08', '#22140d', '#30190f', '#3d2314', '#51301d', '#684229'];
export const PEBBLE = ['#3a4a57', '#5c6f7b', '#8496a0'];
export const ROCK = ['#1f2a33', '#2f3d49', '#445663', '#5c6f7b', '#7d9099', '#a3b3b6'];
export const RUIN = ['#22303a', '#33464f', '#496068', '#627e85', '#86a3a4', '#b3c9c4'];   // pierre taillée, bleutée
export const WATER = ['#0c333d', '#135360', '#1c7784', '#2aa1a8', '#5ccdc8', '#a6eede'];
export const ROT = ['#231710', '#3a281b', '#544031', '#6f5943', '#8d7558'];              // bois vermoulu
export const GOLD = ['#e9b44c', '#ffd56e', '#fff0ae'];
export const GLOW = ['#2c2360', '#4a3fa6', '#5f7fe6', '#6fd6ee', '#c4fbff'];             // champignons du souterrain
export const VIOLET = ['#3a2466', '#6a44b0', '#a67cf0', '#dcc4ff'];
export const FLOWER = { white: '#f4f7e6', yellow: '#ffd978', violet: '#b79cf0', pink: '#f0a7c0' };
export const BIRCH = ['#8f9a8c', '#b9c4b0', '#dde5cf', '#f4f6e6'];                        // bouleaux de la lisière
export const INK = '#0a1210';

// Trois lumières, qui se fondent d'une zone à l'autre.
//   sky   : du haut de l'image à l'horizon ;   haze : couleur de la brume ;
//   ridge : montagnes et cimes lointaines ;     firs : trois rangs de conifères
//   (du plus loin au plus proche : [ombre, teinte, lumière]) ; stems : troncs
//   droits dans la brume (deux profondeurs : [teinte, arête sombre, arête claire]) ;
//   tint, depth : les arbres géants du plan 2 sont fondus (tint) dans la teinte
//   du lointain (depth), pour ne jamais être pris pour des troncs jouables ; ray : rais de
//   lumière ; fore : silhouettes du premier plan.
export const MOODS = {
  matin: {
    name: 'Matin doré (zones 1 à 3)',
    sky: ['#8cc7b4', '#a9d6b0', '#c6e2a8', '#dcebaa', '#eef2b6', '#fbf6cc'],
    haze: '#e6f0b8',
    ridge: ['#a3c9a0', '#8fbb94'],
    firs: [['#a5cc98', '#b4d6a0', '#c6e0ac'], ['#79b07e', '#8dc08a', '#a6d098'], ['#3f8560', '#53996a', '#74b47a']],
    stems: [['#a3cb98', '#93be8c', '#b9d9a6'], ['#63a07a', '#508c6b', '#7fb78a']],
    tint: 0.5, depth: '#4f8c6b',
    ray: '#fff3b0', rayA: 0.62,
    fore: ['#0b2418', '#123522', '#1b4a2c', '#27633a'],
    glow: { x: 0.18, y: 0.0, r: 0.9, k: 0.35 },
  },
  sousbois: {
    name: 'Sous-bois profond (zones 4 à 10)',
    sky: ['#1f7f8f', '#2c96a3', '#44acb4', '#63c2c3', '#8dd6cf', '#b9e8da'],
    haze: '#a9e4d8',
    ridge: ['#4faab2', '#3e98a3'],
    firs: [['#63bcbc', '#74c8c5', '#8fd6cf'], ['#3d9aa0', '#4eaaad', '#69bdba'], ['#1c6672', '#267a82', '#39938f']],
    stems: [['#62bdbd', '#52adb0', '#7fd0cb'], ['#2f8a94', '#237680', '#48a2a6']],
    tint: 0.52, depth: '#1f6f7a',
    ray: '#fff0a8', rayA: 0.6,
    fore: ['#061a1e', '#0a282a', '#103a36', '#185044'],
    glow: { x: 0.5, y: 0.25, r: 0.8, k: 0.3 },
  },
  couchant: {
    name: 'Soleil couchant (zones 11 et 12)',
    sky: ['#4f4576', '#7d5a86', '#b66f84', '#e48f72', '#fbb96e', '#ffe2a0'],
    haze: '#ffd3a0',
    ridge: ['#a8708e', '#8f5f84'],
    firs: [['#d79c8c', '#e3ad90', '#f2c79c'], ['#a56f7c', '#b98182', '#d39e8c'], ['#573c5c', '#6b4a66', '#8a6272']],
    stems: [['#d39a8c', '#c28684', '#eab896'], ['#7f5670', '#6b4664', '#9f7280']],
    tint: 0.5, depth: '#6b4664',
    ray: '#ffe2a0', rayA: 0.55,
    fore: ['#150c1a', '#221426', '#331d30', '#472a3a'],
    glow: { x: 0.78, y: 0.72, r: 0.7, k: 0.5 },
  },
};

// Les lumières à part, dérivées des trois premières ou peintes pour l'occasion.
//   canopee   : tout en haut des arbres, le ciel ouvert, l'air bleu et doré ;
//   sanctuaire: le cirque de la statue, plus sombre, des rais plus francs ;
//   crepuscule: la lisière du soir, violet et braise ;
//   souterrain: sous les racines (le fond est une paroi de terre, voir backdrop.js).
MOODS.canopee = {
  name: 'Canopée (zone 7)',
  sky: ['#4f9fc4', '#6db5cf', '#8ccad6', '#acdcd9', '#cfeace', '#f1f4c6'],
  haze: '#d6efd8',
  ridge: ['#8cbfc4', '#79b0b6'],
  firs: [['#8ec4b4', '#9dcfbd', '#b4dcc6'], ['#5fa38f', '#6fb39b', '#8ac6a8'], ['#2c7457', '#368663', '#4f9c70']],
  stems: [['#8ac4b4', '#7ab5a8', '#a6d6c2'], ['#4f9480', '#3f816f', '#6dad92']],
  tint: 0.42, depth: '#2f7a66',
  ray: '#fff6c0', rayA: 0.5,
  fore: ['#0b2420', '#12352c', '#1b4a38', '#276347'],
  glow: { x: 0.22, y: 0.05, r: 0.9, k: 0.4 },
  crowns: true,
};
MOODS.sanctuaire = {
  name: 'Le sanctuaire de la statue (zone 9)',
  sky: ['#0f3c4c', '#16505e', '#1f6470', '#2c7a80', '#45938f', '#6fb2a5'],
  haze: '#6fb2a5',
  ridge: ['#2d7076', '#24616a'],
  firs: [['#3a8584', '#45938f', '#5aa59b'], ['#21616a', '#2a7076', '#3c8484'], ['#0e3d48', '#145057', '#1f6466']],
  stems: [['#3c8786', '#317878', '#56a199'], ['#185159', '#11434c', '#2a6b6c']],
  tint: 0.56, depth: '#123f4a',
  ray: '#eaffd0', rayA: 0.7,
  fore: ['#03121a', '#071c22', '#0c2a2e', '#133c3a'],
  glow: { x: 0.45, y: 0.0, r: 0.6, k: 0.32 },
};
MOODS.crepuscule = {
  name: 'Crépuscule (zone 12)',
  sky: ['#2b2550', '#47366a', '#6e4878', '#a35a74', '#d57b68', '#f3a86a'],
  haze: '#e7a07a',
  ridge: ['#7a5079', '#64426d'],
  firs: [['#a8708a', '#b9808e', '#cf9a94'], ['#7a4f6e', '#8c5d74', '#a6727c'], ['#3c2848', '#4b3253', '#64425e']],
  stems: [['#a7708a', '#966282', '#c08a92'], ['#5c3e5e', '#4b3253', '#76526a']],
  tint: 0.55, depth: '#4b3253',
  ray: '#ffc98e', rayA: 0.45,
  fore: ['#0e0814', '#180e1e', '#24152a', '#331e34'],
  glow: { x: 0.85, y: 0.78, r: 0.75, k: 0.55 },
};
MOODS.souterrain = {
  name: 'Le souterrain (zone 8)',
  sky: ['#05080b', '#080d11', '#0b1217', '#0f171c', '#131d22', '#172227'],
  haze: '#1c2c30',
  ridge: ['#0d1418', '#0b1115'],
  firs: [['#10191c', '#131e21', '#172427'], ['#0d1518', '#10191c', '#141f22'], ['#0a1013', '#0d1417', '#11191c']],
  stems: [['#1a1612', '#14110e', '#241e18'], ['#120f0c', '#0d0b09', '#1c1814']],
  tint: 0.7, depth: '#0b1013',
  ray: '#6fd6ee', rayA: 0.0,
  fore: ['#030506', '#06090b', '#0a0f11', '#0e1517'],
  glow: null,
  cave: true,
};
