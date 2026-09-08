import type { DrinkType } from "./constants.ts";

/**
 * 純アルコール量の計算・丸め・種類デフォルト。
 * 式と期待値の正本: spec/features/alcohol-calculation.md
 */

export const ETHANOL_DENSITY = 0.8;

export const VOLUME_ML_MIN = 1;
export const VOLUME_ML_MAX = 5000;
export const ABV_PERCENT_MIN = 0;
export const ABV_PERCENT_MAX = 100;

export const ALCOHOL_STORE_DECIMALS = 2;
export const ALCOHOL_DISPLAY_DECIMALS = 1;

/** 全種類共通のボトル量チップ（spec/features/alcohol-calculation.md 4 章） */
export const BOTTLE_VOLUME_CHIPS = [375, 750, 1500] as const;

type DrinkTypePreset = {
  readonly volumeMl: number;
  readonly abvPercent: number;
  readonly volumeChips: readonly number[];
};

type OtherDrinkTypePreset = {
  readonly volumeMl: null;
  readonly abvPercent: null;
  readonly volumeChips: readonly [];
};

const WINE_PRESET: DrinkTypePreset = { volumeMl: 125, abvPercent: 12, volumeChips: [125, 150] };

export const DRINK_TYPE_PRESETS: {
  readonly [K in DrinkType]: K extends "other" ? OtherDrinkTypePreset : DrinkTypePreset;
} = {
  wine_red: WINE_PRESET,
  wine_white: WINE_PRESET,
  wine_rose: WINE_PRESET,
  wine_sparkling: WINE_PRESET,
  wine_orange: WINE_PRESET,
  wine: WINE_PRESET,
  beer: { volumeMl: 350, abvPercent: 5, volumeChips: [200, 350, 500] },
  whisky: { volumeMl: 30, abvPercent: 40, volumeChips: [15, 30, 60] },
  sake: { volumeMl: 180, abvPercent: 15, volumeChips: [90, 180] },
  shochu: { volumeMl: 60, abvPercent: 25, volumeChips: [30, 60, 90] },
  cocktail: { volumeMl: 120, abvPercent: 15, volumeChips: [60, 120, 200] },
  other: { volumeMl: null, abvPercent: null, volumeChips: [] },
};

export type DrinkTypePresets = typeof DRINK_TYPE_PRESETS;

/**
 * 正の数は 0 から遠い方へ四捨五入（Math.round と同じ）。
 * `value * 10^n` の IEEE ずれは例題の期待値を優先して吸収する。
 */
function roundHalfUp(value: number, digits: number): number {
  if (value === 0) {
    return 0;
  }
  const factor = 10 ** digits;
  const absScaled = Math.abs(value) * factor;
  const compensated = absScaled + Number.EPSILON * Math.max(1, absScaled);
  return (Math.round(compensated) / factor) * Math.sign(value);
}

/**
 * 保存用の純アルコール量（g、小数第 2 位）。
 * Zod 済みの number を受ける。不正入力は throw せず呼び元に任せる。
 */
export function calculateAlcoholGrams(volumeMl: number, abvPercent: number): number {
  const raw = ((volumeMl * abvPercent) / 100) * ETHANOL_DENSITY;
  return roundHalfUp(raw, ALCOHOL_STORE_DECIMALS);
}

/** 保存値を小数第 1 位にして表示する。 */
export function displayAlcoholGrams(storedGrams: number): number {
  return roundHalfUp(storedGrams, ALCOHOL_DISPLAY_DECIMALS);
}

/** 各行の保存値を合算し、第 2 位に揃える。行の表示値は足さない。 */
export function sumAlcoholGrams(storedGramsList: readonly number[]): number {
  const sum = storedGramsList.reduce((acc, grams) => acc + grams, 0);
  return roundHalfUp(sum, ALCOHOL_STORE_DECIMALS);
}

/**
 * 休肝日は記録 0 件。0g の行があっても休肝にしない。未来日は数えない。
 */
export function isDryDay(logCount: number, isFuture = false): boolean {
  return !isFuture && logCount === 0;
}

/** 種類の量チップ + ボトル量チップ。 */
export function volumeChipsFor(drinkType: DrinkType): number[] {
  return [...DRINK_TYPE_PRESETS[drinkType].volumeChips, ...BOTTLE_VOLUME_CHIPS];
}
