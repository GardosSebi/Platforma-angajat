import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ManagerTeamMember, ManagerTeamTraffic } from "@repo/shared-types/ssm";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { PaginationBar, paginateClientSlice } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useManagerTeam } from "../hooks/useManagerTeam";
import { useSignPlan, useSignPlansBatch } from "../hooks/useSsmTrainingSuite";

const TRAFFIC_LABEL: Record<ManagerTeamTraffic, string> = {
  GREEN: "La zi",
  YELLOW: "Atenție",
  RED: "Neconform"
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ro-RO");
}

function memberMatches(member: ManagerTeamMember, query: string) {
  if (!query) return true;
  const hay = `${member.fullName} ${member.email} ${member.jobPositionName ?? ""} ${member.departmentName ?? ""}`.toLowerCase();
  return hay.includes(query);
}

export function ManagerTeamPage() {
  const teamQuery = useManagerTeam();
  const signPlan = useSignPlan();
  const signBatch = useSignPlansBatch();
  const pagination = usePagination({ persistKey: "manager-team" });
  const [search, setSearch] = useState("");
  const [trafficFilter, setTrafficFilter] = useState<ManagerTeamTraffic | "">("");
  const [signature, setSignature] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const data = teamQuery.data;
  const members = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.members ?? []).filter((member) => {
      if (trafficFilter && member.traffic !== trafficFilter) return false;
      return memberMatches(member, query);
    });
  }, [data?.members, search, trafficFilter]);

  const paged = paginateClientSlice(members, pagination.page, pagination.pageSize);
  const pending = data?.pendingApprovals ?? [];
  const alerts = data?.alerts ?? [];
  const summary = data?.summary;
  const canSign = signature.startsWith("data:image");

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) => (prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]));
  };

  const approveOne = (planId: string) => {
    if (!canSign) {
      setFeedback("Semnează olograf înainte de aprobare.");
      return;
    }
    setFeedback(null);
    signPlan.mutate(
      { planId, role: "MANAGER", signatureData: signature },
      {
        onSuccess: () => setFeedback("Instruire aprobată."),
        onError: (error) => setFeedback(error instanceof Error ? error.message : "Aprobarea a eșuat.")
      }
    );
  };

  const approveSelected = () => {
    const ids = selectedPlanIds.length ? selectedPlanIds : pending.map((item) => item.planId);
    if (!ids.length || !canSign) {
      setFeedback("Selectează cel puțin o instruire și semnează olograf.");
      return;
    }
    setFeedback(null);
    signBatch.mutate(
      { planIds: ids, role: "MANAGER", signatureData: signature },
      {
        onSuccess: (result) => {
          setSelectedPlanIds([]);
          setFeedback(`Aprobate ${result.signed} din ${result.requested} instruiri.`);
        },
        onError: (error) => setFeedback(error instanceof Error ? error.message : "Aprobarea în pachet a eșuat.")
      }
    );
  };

  return (
    <div className="comms-page manager-team-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">Echipa mea</h1>
          <p className="page-lead">
            Situație SSM pe echipa proprie: conformitate, restanțe, blocări de admitere și aprobare instruiri la locul
            de muncă.
          </p>
          {data ? <p className="field-hint">{data.scopeLabel}</p> : null}
        </div>
        <Link className="btn-secondary" to="/ssm?section=compliance">
          Deschide dashboard SSM
        </Link>
      </header>

      <div className="comms-kpi" aria-label="Indicatori echipă">
        <div>
          <span>Membri</span>
          <strong>{summary?.memberCount ?? "—"}</strong>
        </div>
        <div>
          <span>La zi</span>
          <strong>{summary ? `${summary.compliantPercent}%` : "—"}</strong>
        </div>
        <div>
          <span>Blocări admitere</span>
          <strong>{summary?.blockedAdmissionCount ?? "—"}</strong>
        </div>
        <div>
          <span>Aprobări în așteptare</span>
          <strong>{summary?.pendingApprovalsCount ?? "—"}</strong>
        </div>
        <div>
          <span>Alerte</span>
          <strong>{summary?.alertCount ?? "—"}</strong>
        </div>
      </div>

      {teamQuery.isLoading ? <p>Se încarcă situația echipei…</p> : null}
      {teamQuery.isError ? (
        <p className="feedback error" role="alert">
          Nu am putut încărca echipa. Verifică dacă profilul tău de angajat este asociat departamentului.
        </p>
      ) : null}

      {alerts.length ? (
        <section className="card manager-team-alerts">
          <h2 className="card-title">Alerte neconformități</h2>
          <ul>
            {alerts.slice(0, 12).map((alert, index) => (
              <li key={`${alert.employeeId}-${alert.kind}-${index}`} className={alert.severity}>
                <strong>{alert.employeeName}</strong> — {alert.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">Aprobare instruiri la locul de muncă</h2>
        <p className="field-hint">
          Angajatul a semnat fișa; tu confirmi ca manager. Poți aproba individual sau în pachet.
        </p>
        {!pending.length ? <p className="field-hint">Nicio instruire în așteptarea aprobării tale.</p> : null}
        {pending.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Selectează</th>
                    <th scope="col">Angajat</th>
                    <th scope="col">Instruire</th>
                    <th scope="col">Scadență</th>
                    <th scope="col">Acțiune</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((item) => (
                    <tr key={item.planId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedPlanIds.includes(item.planId)}
                          onChange={() => togglePlan(item.planId)}
                          aria-label={`Selectează ${item.employeeName}`}
                        />
                      </td>
                      <td>{item.employeeName}</td>
                      <td>{item.trainingTypeName}</td>
                      <td>{formatDate(item.dueAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={!canSign || signPlan.isPending}
                          onClick={() => approveOne(item.planId)}
                        >
                          Aprobă
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="manager-team-sign">
              <SignatureCanvas value={signature} onChange={setSignature} label="Semnătură olografă manager" />
              <button
                type="button"
                className="btn-primary"
                disabled={!canSign || signBatch.isPending}
                onClick={approveSelected}
              >
                {signBatch.isPending ? "Se aprobă…" : "Aprobă selecția / toate"}
              </button>
            </div>
          </>
        ) : null}
        {feedback ? (
          <p className="feedback" role="status">
            {feedback}
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="comms-compose-head">
          <h2 className="card-title">Membri echipă</h2>
        </div>
        <div className="comms-form-row">
          <div className="field">
            <label htmlFor="team-search">Caută</label>
            <input
              id="team-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nume, e-mail, post…"
            />
          </div>
          <div className="field">
            <label htmlFor="team-traffic">Semafor</label>
            <select
              id="team-traffic"
              value={trafficFilter}
              onChange={(event) => setTrafficFilter(event.target.value as ManagerTeamTraffic | "")}
            >
              <option value="">Toți</option>
              <option value="RED">Roșu — neconform</option>
              <option value="YELLOW">Galben — atenție</option>
              <option value="GREEN">Verde — la zi</option>
            </select>
          </div>
        </div>
        {!paged.items.length ? <p className="field-hint">Niciun membru pe filtrul curent.</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Angajat</th>
                <th scope="col">Post</th>
                <th scope="col">Semafor</th>
                <th scope="col">Instruiri</th>
                <th scope="col">Medical</th>
                <th scope="col">EIP</th>
                <th scope="col">Admitere</th>
              </tr>
            </thead>
            <tbody>
              {paged.items.map((member) => (
                <Fragment key={member.employeeId}>
                  <tr
                    className={member.isSelf ? "team-member-self" : undefined}
                    onClick={() => setExpandedId((id) => (id === member.employeeId ? null : member.employeeId))}
                  >
                    <td>
                      {member.fullName}
                      {member.isSelf ? <span className="team-self-badge">tu</span> : null}
                    </td>
                    <td>{member.jobPositionName ?? "—"}</td>
                    <td>
                      <span className={`badge-traffic traffic-${member.traffic.toLowerCase()}`}>
                        {TRAFFIC_LABEL[member.traffic]}
                      </span>
                    </td>
                    <td>
                      {member.complianceScore}% · {member.overdueTrainings} restante
                    </td>
                    <td>{member.medicalBlocked ? "Blocat" : formatDate(member.medicalNextDueAt)}</td>
                    <td>{member.eipDueSoon ? `${member.eipDueSoon} scadențe` : "La zi"}</td>
                    <td>
                      {member.blockedAdmission ? (
                        <span className="badge-bad">Nu intra la lucru</span>
                      ) : (
                        <span className="badge-good">OK</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === member.employeeId ? (
                    <tr key={`${member.employeeId}-details`} className="manager-team-details">
                      <td colSpan={7}>
                        {member.issues.length ? (
                          <ul>
                            {member.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="field-hint">Fără restanțe pe acest angajat.</p>
                        )}
                        <Link className="btn-secondary btn-sm" to={`/ssm?section=training`}>
                          Deschide dosar în SSM
                        </Link>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={paged.page}
          pageSize={paged.pageSize}
          total={paged.total}
          totalPages={paged.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    </div>
  );
}
