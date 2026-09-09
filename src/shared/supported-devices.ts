/**
 * サポート端末（6-05）。正本は spec/qa-devices.md。
 * エージェントは実機を持てない。最小バージョンの契約をコードと仕様で揃える。
 */

/** iOS Safari の最小メジャー。17 未満は対象外 */
export const SUPPORTED_IOS_MAJOR_MIN = 17;

/** Android の第一ブラウザ */
export const SUPPORTED_ANDROID_BROWSER = "Chrome";

/**
 * Android Chrome は最新と直前のメジャーを見る。
 * 個別の最小メジャーは年次で変わるので固定しない。
 */
export const SUPPORTED_ANDROID_CHROME_POLICY = "latest-and-previous-major";
