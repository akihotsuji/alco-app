import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansJP";

export const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["500", "700"],
  ignoreTooManyRequestsWarning: true,
});

export const usePromoFont = (): void => {
  const [handle] = useState(() => delayRender("Noto Sans JP"));

  useEffect(() => {
    waitUntilDone()
      .then(() => {
        continueRender(handle);
      })
      .catch((error: unknown) => {
        continueRender(handle);
        throw error;
      });
  }, [handle]);
};
