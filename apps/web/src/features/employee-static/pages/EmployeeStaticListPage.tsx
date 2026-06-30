import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { canAccessTenantAdmin } from "../../../shared/auth/roles";
import { employeeStaticApi } from "../api/employee-static.api";
import { AdminDirectorySection } from "../components/AdminDirectorySection";
import { EmployeeTeamSection } from "../components/EmployeeTeamSection";
import { EmployeeStaticPagesPanel } from "../components/EmployeeStaticPagesPanel";

export function EmployeeStaticListPage() {
  const session = useAuthSession();
  const isTenantAdmin = canAccessTenantAdmin(session);

  const myContextQuery = useQuery({
    queryKey: ["employee-static", "my-context"],
    queryFn: () => employeeStaticApi.getMyContext(),
    enabled: !isTenantAdmin
  });

  const directoryQuery = useQuery({
    queryKey: ["employee-static", "directory"],
    queryFn: () => employeeStaticApi.getDirectory(),
    enabled: isTenantAdmin
  });

  const contextErr =
    (isTenantAdmin ? directoryQuery.error : myContextQuery.error) instanceof Error
      ? (isTenantAdmin ? directoryQuery.error : myContextQuery.error)!.message
      : null;

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Informații</h1>
        <p className="page-lead">
          {isTenantAdmin
            ? "Ca administrator SSM vezi toți angajații pe puncte de lucru și administratorii platformă."
            : "Vezi echipa ta: departament, grupuri și colegii din același punct de lucru."}
        </p>
      </header>

      {isTenantAdmin ? (
        <AdminDirectorySection
          data={directoryQuery.data}
          isLoading={directoryQuery.isLoading}
          error={contextErr}
        />
      ) : (
        <>
          <EmployeeStaticPagesPanel />
          <EmployeeTeamSection
            context={myContextQuery.data}
            isLoading={myContextQuery.isLoading}
            error={contextErr}
          />
        </>
      )}
    </div>
  );
}
