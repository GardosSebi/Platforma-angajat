import { useState } from "react";
import { useDepartments, useEmployees, useGroups, useJobPositions, useLegalEntities, useWorksites } from "../hooks/useMasterData";
import { MasterDataDepartmentsPanel } from "../components/MasterDataDepartmentsPanel";
import { MasterDataEmployeesPanel } from "../components/MasterDataEmployeesPanel";
import { MasterDataGroupsPanel } from "../components/MasterDataGroupsPanel";
import { MasterDataLegalEntitiesPanel } from "../components/MasterDataLegalEntitiesPanel";
import { MasterDataPositionsPanel } from "../components/MasterDataPositionsPanel";
import { MasterDataWorksitesPanel } from "../components/MasterDataWorksitesPanel";
import type { MasterDataTab } from "../master-data-shared";

export function MasterDataPage() {
  const [tab, setTab] = useState<MasterDataTab>("employees");

  const legalEntitiesQuery = useLegalEntities({ page: 1, pageSize: 1 });
  const worksitesQuery = useWorksites({ page: 1, pageSize: 1 });
  const departmentsQuery = useDepartments({ page: 1, pageSize: 1 });
  const positionsQuery = useJobPositions({ page: 1, pageSize: 1 });
  const employeesQuery = useEmployees({ page: 1, pageSize: 1 });
  const groupsQuery = useGroups({ page: 1, pageSize: 1 });

  const tabs: Array<{ id: MasterDataTab; label: string }> = [
    { id: "employees", label: "Angajați" },
    { id: "legal-entities", label: "Entități juridice" },
    { id: "worksites", label: "Puncte de lucru" },
    { id: "departments", label: "Departamente" },
    { id: "positions", label: "Posturi" },
    { id: "groups", label: "Grupuri instruire" }
  ];

  return (
    <div className="comms-page master-data-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">Date master SSM</h1>
          <p className="page-lead">
            Configurează structura organizațională: angajați, posturi, puncte de lucru și grupuri de instruire.
          </p>
        </div>
      </header>

      <div className="comms-kpi" aria-label="Indicatori date master">
        <div>
          <span>Angajați</span>
          <strong>{employeesQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Posturi</span>
          <strong>{positionsQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Puncte de lucru</span>
          <strong>{worksitesQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Grupuri</span>
          <strong>{groupsQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Entități juridice</span>
          <strong>{legalEntitiesQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Departamente</span>
          <strong>{departmentsQuery.data?.total ?? "—"}</strong>
        </div>
      </div>

      <nav className="comms-tabs" aria-label="Secțiuni date master">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comms-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "employees" ? <MasterDataEmployeesPanel /> : null}
      {tab === "legal-entities" ? <MasterDataLegalEntitiesPanel /> : null}
      {tab === "worksites" ? <MasterDataWorksitesPanel /> : null}
      {tab === "departments" ? <MasterDataDepartmentsPanel /> : null}
      {tab === "positions" ? <MasterDataPositionsPanel /> : null}
      {tab === "groups" ? <MasterDataGroupsPanel /> : null}
    </div>
  );
}
