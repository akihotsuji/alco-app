import { ChevronLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { APP_HEADER_TITLE_ID } from "@/client/lib/a11y.ts";
import { historyIdx } from "@/client/lib/history-state.ts";
import { cn } from "@/client/lib/utils.ts";
import {
  formatLegalEffectiveOn,
  legalBackFallback,
  legalFromSchema,
  legalHref,
} from "@/shared/legal.ts";
import type { LegalDocumentKind } from "@/shared/legal-documents.ts";
import { legalDocument } from "@/shared/legal-documents.ts";

function goBack(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  const idx = historyIdx(window.history.state);
  if (typeof idx === "number" && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}

type LegalPageProps = {
  kind: LegalDocumentKind;
};

export function LegalPage({ kind }: LegalPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const doc = legalDocument(kind);
  const fromRaw = searchParams.get("from");
  const from = legalFromSchema.safeParse(fromRaw);
  const fallback = legalBackFallback(fromRaw);
  const relatedTo = legalHref(doc.relatedPath, from.success ? from.data : null);

  return (
    <main className="legal-page">
      <header className="app-header">
        <div className="app-header-slot">
          <IconButton label="戻る" onClick={() => goBack(navigate, fallback)}>
            <ChevronLeft size={22} />
          </IconButton>
        </div>
        <h1 className="app-header-title" id={APP_HEADER_TITLE_ID} tabIndex={-1}>
          {doc.title}
        </h1>
        <div className="app-header-slot app-header-slot-end">
          <span className="app-header-spacer" />
        </div>
      </header>
      <article className="legal-article">
        <p className="legal-draft">{doc.draftNotice}</p>
        <p className="legal-meta">
          版 {doc.version} ／ 施行日 {formatLegalEffectiveOn(doc.effectiveOn)}
        </p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2>{section.heading}</h2>
            {section.blocks.map((block) =>
              block.type === "p" ? (
                <p key={block.text}>{block.text}</p>
              ) : (
                <ul key={block.items.join("\n")}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
        <p className="legal-related">
          <Link className={cn(buttonVariants({ variant: "link" }))} to={relatedTo}>
            {doc.relatedLabel}
          </Link>
        </p>
      </article>
    </main>
  );
}
