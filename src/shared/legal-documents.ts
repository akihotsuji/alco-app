import { LEGAL_DRAFT_NOTICE, LEGAL_EFFECTIVE_ON, LEGAL_VERSION } from "./legal.ts";
import { PROD_CANONICAL_ORIGIN, SERVICE_NAME_JA } from "./prod-canonical.ts";

export type LegalBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocumentKind = "terms" | "privacy";

export type LegalDocument = {
  kind: LegalDocumentKind;
  title: string;
  version: string;
  effectiveOn: string;
  draftNotice: string;
  relatedLabel: string;
  relatedPath: "/terms" | "/privacy";
  sections: LegalSection[];
};

export const TERMS_DOCUMENT: LegalDocument = {
  kind: "terms",
  title: "利用規約",
  version: LEGAL_VERSION,
  effectiveOn: LEGAL_EFFECTIVE_ON,
  draftNotice: LEGAL_DRAFT_NOTICE,
  relatedLabel: "プライバシーポリシー",
  relatedPath: "/privacy",
  sections: [
    {
      heading: "適用",
      blocks: [
        {
          type: "p",
          text: `本規約は、${SERVICE_NAME_JA}（${PROD_CANONICAL_ORIGIN}。以下「本サービス」）の利用条件です。アカウントを作成した時点で、本規約に同意したものとします。`,
        },
      ],
    },
    {
      heading: "運営者",
      blocks: [
        {
          type: "p",
          text: "本サービスは個人が運営します。氏名・住所・連絡先は運営者の承認後に本ページへ掲載します。掲載までの開示請求は、承認後の連絡先へ行ってください。",
        },
      ],
    },
    {
      heading: "サービス内容",
      blocks: [
        {
          type: "p",
          text: "本サービスは、飲酒記録、ボトルのセラー管理、テイスティングノートを、主にスマートフォン向けに提供します。会話するキャラクターや、飲酒を勧める案内は行いません。",
        },
      ],
    },
    {
      heading: "利用資格",
      blocks: [
        {
          type: "p",
          text: "日本国内における酒類の年齢制限に合わせ、満20歳未満の方は利用できません。登録後、専用の年齢確認画面で生年月日を入力し、サーバーが当日（Asia/Tokyo）時点で満20歳以上であることを確認するまで、記録・セラー・ノートなどの機能は使えません。本規約への同意は、利用者が20歳以上であることの表明を含みます。",
        },
      ],
    },
    {
      heading: "アカウント",
      blocks: [
        {
          type: "p",
          text: "メールアドレスとパスワードで登録します。招待コードはありません。認証情報は第三者に貸与・共有しないでください。セッションはCookieで維持します。詳細はプライバシーポリシーを見てください。",
        },
      ],
    },
    {
      heading: "禁止事項",
      blocks: [
        {
          type: "ul",
          items: [
            "法令に反する利用",
            "他者の権利侵害",
            "不正アクセスや本サービスの妨害",
            "未成年者への酒類の勧誘や提供に関する利用",
            "他人になりすます行為",
            "自動大量登録",
          ],
        },
      ],
    },
    {
      heading: "ユーザーコンテンツと写真",
      blocks: [
        {
          type: "p",
          text: "記録・メモ・ノート・写真の著作権は、正当な権利者であるユーザーに残ります。本サービスは、表示・保管・バックアップに必要な範囲でのみ利用します。撮影対象（瓶ラベル等）について、ユーザーが必要な権利を有していることを前提とします。第三者の権利を侵害する写真をアップロードしてはなりません。",
        },
      ],
    },
    {
      heading: "飲酒に関する注意",
      blocks: [
        {
          type: "p",
          text: "本サービスは飲酒を推奨しません。飲酒は利用者の判断と責任です。運転前の飲酒、体調を崩しての飲酒、法令で禁じられた飲酒を助長する目的では使えません。表示する純アルコール量は目安であり、医療上の助言ではありません。",
        },
      ],
    },
    {
      heading: "免責",
      blocks: [
        {
          type: "p",
          text: "本サービスは個人運営のベストエフォートです。正確性、中断のなさ、データの完全な保全を保証しません。法令で認められる範囲で、利用により生じた損害について運営者は責任を負いません。",
        },
      ],
    },
    {
      heading: "外部処理",
      blocks: [
        {
          type: "p",
          text: "ラベルや写真からの候補入力のため、設定が有効なときは画像をCloudflare上のAI（セラー・ノートはWorkers AI、酒記録はCloudflare経由の外部モデル）へ送ります。自動では保存しません。候補が間違っていても、登録は手入力で続けられます。",
        },
      ],
    },
    {
      heading: "変更・終了",
      blocks: [
        {
          type: "p",
          text: "運営者は本サービスを変更または終了できます。本規約を変えるときは、本ページの版と施行日を更新します。重大な変更の再同意は、必要になったときに別途案内します。",
        },
      ],
    },
    {
      heading: "準拠法",
      blocks: [
        {
          type: "p",
          text: "日本法に従います。紛争は、運営者の所在地を管轄する裁判所を第一審の合意管轄とします。所在地は承認後に確定します。",
        },
      ],
    },
  ],
};

export const PRIVACY_DOCUMENT: LegalDocument = {
  kind: "privacy",
  title: "プライバシーポリシー",
  version: LEGAL_VERSION,
  effectiveOn: LEGAL_EFFECTIVE_ON,
  draftNotice: LEGAL_DRAFT_NOTICE,
  relatedLabel: "利用規約",
  relatedPath: "/terms",
  sections: [
    {
      heading: "事業者",
      blocks: [
        {
          type: "p",
          text: "本サービスの運営者（個人）。氏名・住所・連絡先メールは運営者の承認後に本ページへ掲載します。請求があれば、法令に従い遅滞なく開示します。",
        },
      ],
    },
    {
      heading: "取得する情報と目的",
      blocks: [
        {
          type: "p",
          text: "取得する情報は、アカウント（メール、パスワードのハッシュ、任意の表示名）、セッション、規約への同意、年齢確認（生年月日は確認に成功したときだけ）、飲酒記録、マイドリンク、セラー、ノート、加工後の写真、AI利用回数、任意の位置情報（店名と座標）、バックアップ、運用ログです。端末だけの設定（外観、触感、動き、写真の既定、認識のON/OFF、現在地を記録する）はサーバーに送りません。",
        },
        {
          type: "p",
          text: "目的は、認証と設定表示、満20歳以上であることの確認、記録の保存と集計、写真の本人への配信、ラベル等の候補入力、不正防止、障害対応、バックアップ、同意の記録に限ります。販売、広告配信、他ユーザーへの公開には使いません。",
        },
      ],
    },
    {
      heading: "飲酒記録",
      blocks: [
        {
          type: "p",
          text: "杯数、量、度数、日時、場所、メモは、利用者が任意に入れる生活記録です。診療録や健康診断の結果ではありません。診断・治療・保険査定の目的では利用しません。",
        },
      ],
    },
    {
      heading: "写真",
      blocks: [
        {
          type: "p",
          text: "端末内で向き補正・リサイズ・任意のキャラクター合成、セラーは背景除去を行い、加工後の1枚だけを保存します。元画像はサーバーに残しません。配信はログインした本人向けのAPIのみです。保存先のオブジェクトストレージは非公開です。",
        },
      ],
    },
    {
      heading: "位置情報",
      blocks: [
        {
          type: "p",
          text: "設定「現在地を記録する」（既定ON）が有効なときだけ、新規の飲酒記録で端末の位置を1回取得できます。店名は手入力です。地図のURLは保存しません。OFFにすると新規記録では位置を要求しません。保存済みの店名・座標は、OFFにしただけでは消しません。",
        },
      ],
    },
    {
      heading: "AIへの送信",
      blocks: [
        {
          type: "p",
          text: "設定がONのとき、ラベルや酒の写真を送り、候補だけ返します。結果は自動保存しません。セラー・ノートはCloudflare Workers AI、酒記録はCloudflare AI Gateway経由の外部モデル（初期設定はGemini）です。プロンプトやモデル名を利用者から指定することはできません。日次の回数上限があります。",
        },
      ],
    },
    {
      heading: "国外への取扱い",
      blocks: [
        {
          type: "p",
          text: "インフラはCloudflareです（Workers、D1、R2、Workers AI、AI Gateway）。データは日本国外のサーバで処理されることがあります。",
        },
      ],
    },
    {
      heading: "Cookie",
      blocks: [
        {
          type: "p",
          text: "ログイン維持のため、httpOnly、Secure（HTTPS）、SameSite=LaxのセッションCookieを使います。広告・解析用の第三者Cookieは置きません。Cookie同意バナーは出しません。",
        },
      ],
    },
    {
      heading: "第三者提供",
      blocks: [
        {
          type: "p",
          text: "法令に基づく場合を除き、個人情報を第三者に販売・提供しません。Cloudflareおよび（酒記録の推定時）その先のモデル提供者は、サービス提供のための委託先です。",
        },
      ],
    },
    {
      heading: "保管期間と削除",
      blocks: [
        {
          type: "p",
          text: "アカウントがある間、サービス提供に必要なデータを保管します。未紐付け写真は作成から24時間で削除します。データベースのバックアップは約14日です。アカウント削除の画面は未実装です。削除を希望する場合は、本ポリシー掲載の連絡先（承認後）へ請求してください。請求が確認できたときは、法令とバックアップの保持期間の範囲で削除します。",
        },
      ],
    },
    {
      heading: "開示・訂正・利用停止",
      blocks: [
        {
          type: "p",
          text: "本人確認のうえで、法令に定める開示・訂正・利用停止等に対応します。請求先は承認後の連絡先です。",
        },
      ],
    },
    {
      heading: "安全管理",
      blocks: [
        {
          type: "p",
          text: "通信はHTTPSです。パスワードはハッシュのみを保存し、アプリから読み出しません。APIはセッションのユーザーIDでデータを区切ります。他ユーザーの記録・写真にはアクセスできません。",
        },
      ],
    },
    {
      heading: "改定",
      blocks: [
        {
          type: "p",
          text: "本ポリシーを変えるときは、本ページの版と施行日を更新します。重大な変更の再同意手順は、必要になったときに追加します。",
        },
      ],
    },
  ],
};

export function legalDocument(kind: LegalDocumentKind): LegalDocument {
  return kind === "terms" ? TERMS_DOCUMENT : PRIVACY_DOCUMENT;
}
