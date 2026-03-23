import { ColorSpace } from '../classes/type-definitions.js';

export type ColorThemeName = 'neon' | 'sunset' | 'ice' | 'midnight';

type Palette = Record<ColorSpace, Array<[number, number, number]>>;

const neon: Palette = {
  [ColorSpace.purple]: [[93, 63, 211], [109, 77, 232], [145, 110, 255], [55, 48, 163], [72, 61, 139], [75, 0, 130], [147, 112, 219], [123, 104, 238], [160, 130, 250]],
  [ColorSpace.pink]: [[255, 105, 180], [255, 20, 147], [255, 182, 193], [255, 130, 171], [255, 174, 185], [219, 112, 147], [199, 21, 133]],
  [ColorSpace.red]: [[255, 69, 58], [255, 99, 71], [220, 20, 60], [255, 82, 82], [255, 110, 89], [231, 76, 60], [255, 74, 91]],
  [ColorSpace.orange]: [[255, 159, 67], [255, 140, 0], [255, 127, 80], [255, 168, 82], [255, 180, 120], [255, 111, 66]],
  [ColorSpace.yellow]: [[255, 221, 89], [255, 215, 0], [255, 235, 59], [255, 230, 128], [240, 220, 130], [255, 244, 143]],
  [ColorSpace.green]: [[0, 201, 167], [50, 205, 50], [0, 255, 127], [144, 238, 144], [102, 255, 204], [46, 204, 113], [76, 187, 23]],
  [ColorSpace.blue]: [[65, 105, 225], [0, 191, 255], [70, 130, 180], [30, 144, 255], [52, 172, 224], [103, 178, 255]]
};

const sunset: Palette = {
  [ColorSpace.purple]: [[118, 70, 140], [142, 94, 163], [171, 123, 191], [97, 70, 111]],
  [ColorSpace.pink]: [[255, 153, 187], [255, 130, 146], [232, 113, 148], [255, 178, 190]],
  [ColorSpace.red]: [[255, 94, 87], [235, 87, 87], [214, 79, 79], [255, 120, 100]],
  [ColorSpace.orange]: [[255, 149, 82], [255, 168, 94], [246, 140, 86], [230, 126, 48]],
  [ColorSpace.yellow]: [[255, 211, 105], [255, 195, 82], [243, 196, 105], [232, 186, 72]],
  [ColorSpace.green]: [[171, 205, 151], [148, 184, 135], [182, 214, 164], [137, 181, 150]],
  [ColorSpace.blue]: [[120, 160, 204], [140, 177, 220], [103, 146, 193], [90, 128, 176]]
};

const ice: Palette = {
  [ColorSpace.purple]: [[130, 146, 255], [116, 130, 230], [96, 116, 210], [150, 170, 255]],
  [ColorSpace.pink]: [[190, 210, 255], [175, 205, 245], [206, 220, 255], [185, 200, 240]],
  [ColorSpace.red]: [[200, 105, 125], [210, 120, 140], [190, 90, 120], [205, 130, 150]],
  [ColorSpace.orange]: [[200, 150, 120], [210, 160, 130], [190, 140, 120], [220, 170, 140]],
  [ColorSpace.yellow]: [[230, 220, 150], [220, 210, 140], [240, 230, 160], [210, 200, 140]],
  [ColorSpace.green]: [[140, 200, 190], [150, 210, 200], [120, 190, 175], [110, 175, 165]],
  [ColorSpace.blue]: [[140, 200, 255], [120, 185, 240], [100, 170, 225], [160, 210, 255]]
};

const midnight: Palette = {
  [ColorSpace.purple]: [[48, 36, 86], [70, 52, 120], [92, 74, 150], [64, 52, 104]],
  [ColorSpace.pink]: [[122, 86, 124], [144, 96, 140], [166, 110, 156], [130, 92, 132]],
  [ColorSpace.red]: [[140, 62, 74], [158, 74, 82], [176, 82, 88], [150, 66, 78]],
  [ColorSpace.orange]: [[150, 92, 70], [170, 110, 82], [186, 126, 96], [160, 100, 78]],
  [ColorSpace.yellow]: [[184, 150, 90], [200, 166, 104], [214, 178, 118], [190, 158, 100]],
  [ColorSpace.green]: [[70, 104, 86], [88, 124, 104], [106, 144, 122], [82, 118, 96]],
  [ColorSpace.blue]: [[46, 70, 112], [60, 90, 134], [82, 116, 158], [54, 78, 120]]
};

const palettes: Record<ColorThemeName, Palette> = { neon, sunset, ice, midnight };

let currentTheme: ColorThemeName = 'neon';

export const setColorTheme = (name: ColorThemeName) => {
  if (palettes[name]) {
    currentTheme = name;
  }
  return currentTheme;
};

export const getColorTheme = () => currentTheme;

export const getPalette = (): Palette => palettes[currentTheme];

export const listThemes = (): ColorThemeName[] => Object.keys(palettes) as ColorThemeName[];
