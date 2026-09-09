import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { Me } from "@/shared/age.ts";

export function useVerifyAge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (birthOn: string) =>
      unwrap(api.api.me["age-verification"].$post({ json: { birthOn } })),
    onSuccess: () => {
      queryClient.setQueryData<Me>(queryKeys.me, (previous) =>
        previous ? { ...previous, ageVerified: true } : previous,
      );
    },
  });
}
