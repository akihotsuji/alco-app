import { describe, expect, it } from "vitest";
import { LEGAL_VERSION } from "./legal.ts";
import {
  googleSignupAdditionalDataSchema,
  isGoogleOAuthUserCreatePath,
  readSocialSignInLegal,
} from "./oauth.ts";

describe("readSocialSignInLegal", () => {
  it("requestSignUp と additionalData だけ読む", () => {
    expect(readSocialSignInLegal(undefined)).toEqual({
      requestSignUp: false,
      additionalData: undefined,
    });
    expect(
      readSocialSignInLegal({
        requestSignUp: true,
        additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
      }),
    ).toEqual({
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
    });
    expect(readSocialSignInLegal({ requestSignUp: "true" })).toEqual({
      requestSignUp: false,
      additionalData: undefined,
    });
  });
});

describe("googleSignupAdditionalDataSchema", () => {
  it("現行版への同意だけ通す", () => {
    expect(
      googleSignupAdditionalDataSchema.safeParse({
        acceptedLegal: true,
        legalVersion: LEGAL_VERSION,
      }).success,
    ).toBe(true);
    expect(
      googleSignupAdditionalDataSchema.safeParse({
        acceptedLegal: false,
        legalVersion: LEGAL_VERSION,
      }).success,
    ).toBe(false);
  });
});

describe("isGoogleOAuthUserCreatePath", () => {
  it("Google の作成経路だけ真", () => {
    expect(isGoogleOAuthUserCreatePath("/callback/google")).toBe(true);
    expect(isGoogleOAuthUserCreatePath("/sign-in/social")).toBe(true);
    expect(isGoogleOAuthUserCreatePath("/sign-up/email")).toBe(false);
    expect(isGoogleOAuthUserCreatePath(undefined)).toBe(false);
  });
});
