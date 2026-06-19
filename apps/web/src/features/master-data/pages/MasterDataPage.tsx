import { useState } from "react";
import { useDepartments, useJobPositions, useWorksites } from "../hooks/useMasterData";
import { MasterDataDepartmentsPanel } from "../components/MasterDataDepartmentsPanel";
import { MasterDataPositionsPanel } from "../components/MasterDataPositionsPanel";
import { MasterDataWorksitesPanel } from "../components/MasterDataWorksitesPanel";
import type { MasterDataTab } from "../master-data-shared";

export function MasterDataPage() {
  const [tab, setTab] = useState<MasterDataTab>("worksites");

  const worksitesQuery = useWorksites({ page: 1, pageSize: 1 });
  const departmentsQuery = useDepartments({ page: 1, pageSize: 1 });
  const positionsQuery = useJobPositions({ page: 1, pageSize: 1 });

  const tabs: Array<{ id: MasterDataTab; label: string }> = [
    { id: "worksites", label: "Puncte de lucru" },
    { id: "departments", label: "Departamente" },
    { id: "positions", label: "Posturi" }
  ];

  return (
    <div className="comms-page master-data-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">Date master</h1>
          <p className="page-lead">Configurează structura organizațională: puncte de lucru, departamente și posturi.</p>
        </div>
      </header>

      <div className="comms-kpi" aria-label="Indicatori date master">
        <div>
          <span>Puncte de lucru</span>
          <strong>{worksitesQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Departamente</span>
          <strong>{departmentsQuery.data?.total ?? "—"}</strong>
        </div>
        <div>
          <span>Posturi</span>
          <strong>{positionsQuery.data?.total ?? "—"}</strong>
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

      {tab === "worksites" ? <MasterDataWorksitesPanel /> : null}
      {tab === "departments" ? <MasterDataDepartmentsPanel /> : null}
      {tab === "positions" ? <MasterDataPositionsPanel /> : null}
    </div>
  );
}
