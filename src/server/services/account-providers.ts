import { eq } from "drizzle-orm";
import type { AppSqliteDb } from "@/db/index.ts";
import { account } from "@/db/schema.ts";
import { CREDENTIAL_PROVIDER_ID, GOOGLE_ACCOUNT_PROVIDER_ID } from "@/shared/account-deletion.ts";

export type AuthProviders = {
  hasPassword: boolean;
  hasGoogle: boolean;
};

/** `account.password` は見ない。`provider_id` だけ取る。 */
export async function listAuthProviders(db: AppSqliteDb, userId: string): Promise<AuthProviders> {
  const rows = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  return {
    hasPassword: rows.some((row) => row.providerId === CREDENTIAL_PROVIDER_ID),
    hasGoogle: rows.some((row) => row.providerId === GOOGLE_ACCOUNT_PROVIDER_ID),
  };
}
