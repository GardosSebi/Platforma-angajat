import { Navigate, useSearchParams } from "react-router-dom";

/** Redirect legacy/deep link to inline forgot panel on login. */
export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim();
  const qs = new URLSearchParams({ forgot: "1" });
  if (tenantId) qs.set("tenantId", tenantId);
  return <Navigate to={`/login?${qs.toString()}`} replace />;
}
