import { Search } from "lucide-react";
import {
  DRINK_SEARCH_LABEL,
  type DrinkSearchFields,
  drinkSearchAriaLabel,
  drinkSearchHref,
} from "@/shared/drink-search.ts";

export type DrinkSearchLinkProps = DrinkSearchFields;

/**
 * 品名付近の外部 Google 検索。クリック時だけ別タブへ行く。
 * 保存・認識・離脱ガードは起こさない。
 */
export function DrinkSearchLink({ name, producer, vintage, drinkType }: DrinkSearchLinkProps) {
  const href = drinkSearchHref({ name, producer, vintage, drinkType });
  if (!href || !name) {
    return null;
  }
  return (
    <a
      className="drink-search-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={drinkSearchAriaLabel(name)}
    >
      <Search size={16} aria-hidden />
      {DRINK_SEARCH_LABEL}
    </a>
  );
}
