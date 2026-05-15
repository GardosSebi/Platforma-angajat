import { queryClient } from "../../app/query-client";

/** Drop cached API data tied to the previous account (e.g. survey “completat”). */
export function clearUserScopedQueryCache() {
  void queryClient.removeQueries();
}
