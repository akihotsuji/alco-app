export type DemoBottle = {
  name: string;
  drinkTypeLabel: string;
  vintage: string;
  variety: string;
  producer: string;
  origin: string;
  photo: string;
};

export type DemoLog = {
  name: string;
  drinkTypeLabel: string;
  place: string;
  photo: string;
};

export type DemoNote = {
  name: string;
  drinkTypeLabel: string;
  ratingStar: 4 | 5;
  halfStar: boolean;
  taste: string;
  photo: string;
};

/** 架空のデモ銘柄。実在ブランド名・本番データは使わない */
export const DEMO_BOTTLES: DemoBottle[] = [
  {
    name: "北窓ヴィンヤード ピノ・ノワール",
    drinkTypeLabel: "赤ワイン",
    vintage: "2022",
    variety: "ピノ・ノワール",
    producer: "北窓ヴィンヤード",
    origin: "日本",
    photo: "bottle-red.jpg",
  },
  {
    name: "南丘ワイナリー シャルドネ",
    drinkTypeLabel: "白ワイン",
    vintage: "2023",
    variety: "シャルドネ",
    producer: "南丘ワイナリー",
    origin: "日本",
    photo: "bottle-white.jpg",
  },
  {
    name: "霧谷蒸溜所 12年",
    drinkTypeLabel: "ウイスキー",
    vintage: "",
    variety: "",
    producer: "霧谷蒸溜所",
    origin: "日本",
    photo: "bottle-whisky.jpg",
  },
  {
    name: "白嶺 純米大吟醸",
    drinkTypeLabel: "日本酒",
    vintage: "",
    variety: "",
    producer: "白嶺酒造",
    origin: "日本",
    photo: "bottle-sake.jpg",
  },
  {
    name: "海風ブリュット",
    drinkTypeLabel: "スパークリング",
    vintage: "2021",
    variety: "",
    producer: "海風醸造",
    origin: "日本",
    photo: "bottle-sparkling.jpg",
  },
  {
    name: "橙畑 スキンコンタクト",
    drinkTypeLabel: "オレンジ",
    vintage: "2022",
    variety: "甲州",
    producer: "橙畑",
    origin: "日本",
    photo: "bottle-orange.jpg",
  },
];

export const DEMO_LOGS: DemoLog[] = [
  {
    name: "北窓ヴィンヤード ピノ・ノワール",
    drinkTypeLabel: "赤ワイン",
    place: "自宅",
    photo: "glass-red.jpg",
  },
  {
    name: "霧谷蒸溜所 12年",
    drinkTypeLabel: "ウイスキー",
    place: "自宅",
    photo: "glass-whisky.jpg",
  },
  {
    name: "白嶺 純米大吟醸",
    drinkTypeLabel: "日本酒",
    place: "自宅",
    photo: "glass-sake.jpg",
  },
];

export const DEMO_NOTES: DemoNote[] = [
  {
    name: "北窓ヴィンヤード ピノ・ノワール",
    drinkTypeLabel: "赤ワイン",
    ratingStar: 4,
    halfStar: true,
    taste: "黒いベリーと杉。夜にゆっくり。",
    photo: "glass-red.jpg",
  },
  {
    name: "白嶺 純米大吟醸",
    drinkTypeLabel: "日本酒",
    ratingStar: 4,
    halfStar: false,
    taste: "米の甘みと、すっきりした後味。",
    photo: "glass-sake.jpg",
  },
];
