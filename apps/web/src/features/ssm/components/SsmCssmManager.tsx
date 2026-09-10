import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateSsmCssmCommitteeRequest,
  CreateSsmCssmMeetingRequest,
  CreateSsmCssmMemberRequest,
  SsmCssmMeetingKind,
  SsmCssmMeetingStatus,
  SsmCssmMemberRole
} from "@repo/shared-types/ssm";
import { SSM_CSSM_MEETING_KINDS, SSM_CSSM_MEMBER_ROLES } from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useLegalEntitiesLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import {
  useAddCssmMember,
  useCancelCssmMeeting,
  useConveneCssmMeeting,
  useCreateCssmCommittee,
  useCreateCssmMeeting,
  useCssmCommittee,
  useCssmCommittees,
  useHoldCssmMeeting,
  useSaveCssmMinutes,
  useUpdateCssmAttendee,
  useUpdateCssmCommittee,
  useUpdateCssmMember
} from "../hooks/useSsmCssm";

type CssmTab = "members" | "meetings" | "minutes";

const ROLE_LABELS: Record<SsmCssmMemberRole, string> = {
  PRESIDENT: "Președinte",
  SECRETARY: "Secretar",
  EMPLOYER_REPRESENTATIVE: "Reprezentant angajator",
  EMPLOYEE_REPRESENTATIVE: "Reprezentant lucrători",
  OCCUPATIONAL_PHYSICIAN: "Medic medicina muncii",
  DESIGNATED_WORKER: "Lucrător desemnat",
  OTHER: "Alt rol"
};

const KIND_LABELS: Record<SsmCssmMeetingKind, string> = {
  ORDINARY: "Ordinară",
  EXTRAORDINARY: "Extraordinară"
};

const STATUS_LABELS: Record<SsmCssmMeetingStatus, string> = {
  DRAFT: "Ciornă",
  CONVENED: "Convocată",
  HELD: "Ținută",
  CANCELLED: "Anulată"
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRoDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ro-RO");
}

function statusChip(status: SsmCssmMeetingStatus): string {
  if (status === "HELD") return "ssm-chip good";
  if (status === "CANCELLED") return "ssm-chip bad";
  if (status === "CONVENED") return "ssm-chip warn";
  return "ssm-chip";
}

const EMPTY_COMMITTEE: CreateSsmCssmCommitteeRequest = {
  legalEntityId: "",
  name: "Comitet de securitate și sănătate în muncă",
  decisionNumber: "",
  decisionDate: "",
  constitutedAt: "",
  notes: ""
};

const EMPTY_MEMBER: CreateSsmCssmMemberRequest = {
  employeeId: "",
  fullName: "",
  role: "EMPLOYEE_REPRESENTATIVE",
  functionTitle: "",
  appointedAt: "",
  notes: ""
};

const EMPTY_MEETING: CreateSsmCssmMeetingRequest = {
  kind: "ORDINARY",
  title: "Ședință ordinară CSSM",
  scheduledAt: new Date().toISOString(),
  location: "",
  agenda: "1. Situația SSM\n2. Accidente și incidente\n3. Măsuri PPP\n4. Diverse"
};

export function SsmCssmManager() {
  const session = useAuthSession();
  const canEdit = hasPermission(session?.roles, "ssm:cssm:edit");
  const [tab, setTab] = useState<CssmTab>("members");
  const [committeeId, setCommitteeId] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [committeeForm, setCommitteeForm] = useState(EMPTY_COMMITTEE);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER);
  const [meetingForm, setMeetingForm] = useState(EMPTY_MEETING);
  const [minutesForm, setMinutesForm] = useState({ number: "", topics: "", decisions: "", nextMeetingAt: "" });
  const [signature, setSignature] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const legalEntities = useLegalEntitiesLookup();
  const listQuery = useCssmCommittees();
  const committees = listQuery.data?.items ?? [];
  const detailQuery = useCssmCommittee(committeeId || undefined);
  const committee = detailQuery.data ?? committees.find((item) => item.id === committeeId);
  const meetings = committee?.meetings ?? [];
  const activeMeeting = meetings.find((item) => item.id === meetingId) ?? meetings[0];

  const createCommittee = useCreateCssmCommittee();
  const updateCommittee = useUpdateCssmCommittee();
  const addMember = useAddCssmMember();
  const updateMember = useUpdateCssmMember();
  const createMeeting = useCreateCssmMeeting();
  const conveneMeeting = useConveneCssmMeeting();
  const holdMeeting = useHoldCssmMeeting();
  const cancelMeeting = useCancelCssmMeeting();
  const updateAttendee = useUpdateCssmAttendee();
  const saveMinutes = useSaveCssmMinutes();

  useEffect(() => {
    if (!committeeId && committees[0]?.id) {
      setCommitteeId(committees[0].id);
    }
  }, [committeeId, committees]);

  useEffect(() => {
    if (activeMeeting?.id && meetingId !== activeMeeting.id) {
      setMeetingId(activeMeeting.id);
    }
  }, [activeMeeting?.id, meetingId]);

  useEffect(() => {
    setMinutesForm({
      number: activeMeeting?.minutes?.number ?? "",
      topics: activeMeeting?.minutes?.topics ?? "",
      decisions: activeMeeting?.minutes?.decisions ?? "",
      nextMeetingAt: toDateInput(activeMeeting?.minutes?.nextMeetingAt)
    });
  }, [activeMeeting?.id, activeMeeting?.minutes?.number, activeMeeting?.minutes?.topics, activeMeeting?.minutes?.decisions, activeMeeting?.minutes?.nextMeetingAt]);

  const entityOptions = useMemo(
    () => mapToOptions(legalEntities.data?.items ?? [], (item) => item.id, (item) => `${item.name}${item.cui ? ` (${item.cui})` : ""}`),
    [legalEntities.data?.items]
  );

  const onCreateCommittee = (event: FormEvent) => {
    event.preventDefault();
    if (!committeeForm.legalEntityId) return;
    createCommittee.mutate(
      {
        ...committeeForm,
        decisionNumber: committeeForm.decisionNumber?.trim() || undefined,
        decisionDate: committeeForm.decisionDate || undefined,
        constitutedAt: committeeForm.constitutedAt || undefined,
        notes: committeeForm.notes?.trim() || undefined
      },
      {
        onSuccess: (created) => {
          setCommitteeId(created.id);
          setCommitteeForm(EMPTY_COMMITTEE);
        }
      }
    );
  };

  const onAddMember = (event: FormEvent) => {
    event.preventDefault();
    if (!committeeId) return;
    addMember.mutate({
      committeeId,
      payload: {
        ...memberForm,
        employeeId: memberForm.employeeId || undefined,
        fullName: memberForm.fullName?.trim() || undefined,
        functionTitle: memberForm.functionTitle?.trim() || undefined,
        appointedAt: memberForm.appointedAt || undefined,
        notes: memberForm.notes?.trim() || undefined
      }
    });
  };

  const onCreateMeeting = (event: FormEvent) => {
    event.preventDefault();
    if (!committeeId) return;
    createMeeting.mutate(
      {
        committeeId,
        payload: {
          ...meetingForm,
          location: meetingForm.location?.trim() || undefined,
          agenda: meetingForm.agenda?.trim() || undefined
        }
      },
      {
        onSuccess: (created) => {
          setMeetingId(created.id);
          setTab("meetings");
        }
      }
    );
  };

  const onSaveMinutes = (event: FormEvent) => {
    event.preventDefault();
    if (!activeMeeting?.id) return;
    saveMinutes.mutate({
      meetingId: activeMeeting.id,
      payload: {
        number: minutesForm.number.trim() || undefined,
        topics: minutesForm.topics.trim() || undefined,
        decisions: minutesForm.decisions.trim() || undefined,
        nextMeetingAt: minutesForm.nextMeetingAt || undefined
      }
    });
  };

  return (
    <div className="ssm-panel-layout">
      <div className="card form-stack ssm-doc-card">
        <div className="ssm-card-header">
          <h4 className="card-title">Comisii CSSM</h4>
        </div>
        <p className="field-hint">
          Comitetul de securitate și sănătate în muncă — componență, convocări și procese-verbale. Deciziile de
          numire rămân și în biblioteca de documente (tip DECISION).
        </p>
        <div className="ssm-doc-items">
          {committees.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ssm-doc-item ${committeeId === item.id ? "selected" : ""}`}
              onClick={() => setCommitteeId(item.id)}
            >
              <strong>{item.name}</strong>
              <span>
                {item.legalEntityName} · {item.members.filter((m) => m.active).length} membri ·{" "}
                {item.meetings.length} ședințe
              </span>
              <span className={item.active ? "ssm-chip good" : "ssm-chip"}>{item.active ? "Activă" : "Inactivă"}</span>
            </button>
          ))}
          {!committees.length ? <p className="field-hint">Nu există încă o comisie CSSM.</p> : null}
        </div>
        {canEdit ? (
          <form className="form-stack" onSubmit={onCreateCommittee}>
            <h5 className="ssm-subtitle">Comisie nouă</h5>
            <FieldSelect
              id="cssm-entity"
              label="Entitate juridică"
              value={committeeForm.legalEntityId}
              onChange={(legalEntityId) => setCommitteeForm((prev) => ({ ...prev, legalEntityId }))}
              options={entityOptions}
              required
              allowEmpty
              emptyLabel="Selectează entitatea"
            />
            <div className="field">
              <label htmlFor="cssm-name">Denumire</label>
              <input
                id="cssm-name"
                value={committeeForm.name}
                onChange={(event) => setCommitteeForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cssm-decision">Nr. decizie constituire</label>
              <input
                id="cssm-decision"
                value={committeeForm.decisionNumber ?? ""}
                onChange={(event) => setCommitteeForm((prev) => ({ ...prev, decisionNumber: event.target.value }))}
                placeholder="ex. 12/2026"
              />
            </div>
            <div className="field">
              <label htmlFor="cssm-decision-date">Data deciziei</label>
              <input
                id="cssm-decision-date"
                type="date"
                value={committeeForm.decisionDate ?? ""}
                onChange={(event) => setCommitteeForm((prev) => ({ ...prev, decisionDate: event.target.value }))}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createCommittee.isPending}>
              {createCommittee.isPending ? "Se creează…" : "Creează comisia"}
            </button>
            {createCommittee.isError ? (
              <p className="feedback error">{mutationErrorMessage(createCommittee.error)}</p>
            ) : null}
          </form>
        ) : null}
      </div>

      <div className="card form-stack ssm-doc-card">
        {!committee ? (
          <p className="field-hint">Selectează sau creează o comisie CSSM.</p>
        ) : (
          <>
            <div className="ssm-card-header">
              <h4 className="card-title">{committee.name}</h4>
              {canEdit ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    updateCommittee.mutate({
                      committeeId: committee.id,
                      payload: { active: !committee.active }
                    })
                  }
                >
                  {committee.active ? "Dezactivează" : "Reactivează"}
                </button>
              ) : null}
            </div>
            <p className="field-hint">
              {committee.legalEntityName}
              {committee.decisionNumber ? ` · Decizie ${committee.decisionNumber}` : ""}
            </p>
            {committee.compositionWarnings.length ? (
              <div className="callout-warn" role="status">
                {committee.compositionWarnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}

            <div className="ssm-overview-tabs" role="tablist" aria-label="CSSM">
              {(
                [
                  { id: "members", title: "Componență", caption: "Membri și roluri" },
                  { id: "meetings", title: "Ședințe", caption: "Convocări" },
                  { id: "minutes", title: "Procese-verbale", caption: "Hotărâri" }
                ] as Array<{ id: CssmTab; title: string; caption: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`ssm-overview-tab ${tab === item.id ? "active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.caption}</span>
                </button>
              ))}
            </div>

            {tab === "members" ? (
              <>
                <div className="ssm-history-list">
                  {committee.members.map((member) => (
                    <div key={member.id} className="ssm-history-item">
                      <div>
                        <strong>{member.fullName}</strong>
                        <div className="field-hint">
                          {member.roleLabel}
                          {member.functionTitle ? ` · ${member.functionTitle}` : ""}
                        </div>
                      </div>
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            updateMember.mutate({
                              memberId: member.id,
                              payload: { active: !member.active }
                            })
                          }
                        >
                          {member.active ? "Retrage" : "Reactivează"}
                        </button>
                      ) : (
                        <span className={member.active ? "ssm-chip good" : "ssm-chip"}>
                          {member.active ? "Activ" : "Inactiv"}
                        </span>
                      )}
                    </div>
                  ))}
                  {!committee.members.length ? <p className="field-hint">Adaugă membrii comisiei.</p> : null}
                </div>
                {canEdit ? (
                  <form className="form-stack" onSubmit={onAddMember}>
                    <h5 className="ssm-subtitle">Membru nou</h5>
                    <EmployeeSelect
                      id="cssm-member-employee"
                      label="Angajat"
                      value={memberForm.employeeId ?? ""}
                      allowEmpty
                      emptyLabel="Selectează angajat (opțional)"
                      onChange={(employeeId) => setMemberForm((prev) => ({ ...prev, employeeId }))}
                    />
                    <div className="field">
                      <label htmlFor="cssm-member-name">Nume (dacă nu e angajat intern)</label>
                      <input
                        id="cssm-member-name"
                        value={memberForm.fullName ?? ""}
                        onChange={(event) => setMemberForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      />
                    </div>
                    <FieldSelect
                      id="cssm-member-role"
                      label="Rol CSSM"
                      value={memberForm.role}
                      onChange={(role) => setMemberForm((prev) => ({ ...prev, role: role as SsmCssmMemberRole }))}
                      options={SSM_CSSM_MEMBER_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                      required
                    />
                    <div className="field">
                      <label htmlFor="cssm-member-function">Funcția</label>
                      <input
                        id="cssm-member-function"
                        value={memberForm.functionTitle ?? ""}
                        onChange={(event) => setMemberForm((prev) => ({ ...prev, functionTitle: event.target.value }))}
                      />
                    </div>
                    <button className="btn-primary" type="submit" disabled={addMember.isPending}>
                      {addMember.isPending ? "Se adaugă…" : "Adaugă membru"}
                    </button>
                    {addMember.isError ? <p className="feedback error">{mutationErrorMessage(addMember.error)}</p> : null}
                  </form>
                ) : null}
              </>
            ) : null}

            {tab === "meetings" ? (
              <>
                <div className="ssm-history-list">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="ssm-history-item">
                      <button
                        type="button"
                        className="ssm-link-btn"
                        onClick={() => {
                          setMeetingId(meeting.id);
                          setTab("minutes");
                        }}
                      >
                        <strong>{meeting.title}</strong>
                        <div className="field-hint">
                          {KIND_LABELS[meeting.kind]} · {formatRoDateTime(meeting.scheduledAt)}
                          {meeting.location ? ` · ${meeting.location}` : ""}
                        </div>
                      </button>
                      <span className={statusChip(meeting.status)}>{STATUS_LABELS[meeting.status]}</span>
                    </div>
                  ))}
                  {!meetings.length ? <p className="field-hint">Nu există ședințe înregistrate.</p> : null}
                </div>
                {canEdit ? (
                  <form className="form-stack" onSubmit={onCreateMeeting}>
                    <h5 className="ssm-subtitle">Ședință / convocare nouă</h5>
                    <FieldSelect
                      id="cssm-meeting-kind"
                      label="Tip"
                      value={meetingForm.kind ?? "ORDINARY"}
                      onChange={(kind) =>
                        setMeetingForm((prev) => ({ ...prev, kind: kind as SsmCssmMeetingKind }))
                      }
                      options={SSM_CSSM_MEETING_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
                    />
                    <div className="field">
                      <label htmlFor="cssm-meeting-title">Titlu</label>
                      <input
                        id="cssm-meeting-title"
                        value={meetingForm.title}
                        onChange={(event) => setMeetingForm((prev) => ({ ...prev, title: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cssm-meeting-when">Data și ora</label>
                      <input
                        id="cssm-meeting-when"
                        type="datetime-local"
                        value={toDatetimeLocal(meetingForm.scheduledAt)}
                        onChange={(event) =>
                          setMeetingForm((prev) => ({
                            ...prev,
                            scheduledAt: new Date(event.target.value).toISOString()
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cssm-meeting-location">Locație</label>
                      <input
                        id="cssm-meeting-location"
                        value={meetingForm.location ?? ""}
                        onChange={(event) => setMeetingForm((prev) => ({ ...prev, location: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cssm-meeting-agenda">Ordinea de zi</label>
                      <textarea
                        id="cssm-meeting-agenda"
                        rows={4}
                        value={meetingForm.agenda ?? ""}
                        onChange={(event) => setMeetingForm((prev) => ({ ...prev, agenda: event.target.value }))}
                      />
                    </div>
                    <button className="btn-primary" type="submit" disabled={createMeeting.isPending}>
                      {createMeeting.isPending ? "Se creează…" : "Creează ședința"}
                    </button>
                    {createMeeting.isError ? (
                      <p className="feedback error">{mutationErrorMessage(createMeeting.error)}</p>
                    ) : null}
                  </form>
                ) : null}
              </>
            ) : null}

            {tab === "minutes" ? (
              !activeMeeting ? (
                <p className="field-hint">Creează mai întâi o ședință.</p>
              ) : (
                <>
                  <div className="ssm-card-header">
                    <h5 className="ssm-subtitle">{activeMeeting.title}</h5>
                    <span className={statusChip(activeMeeting.status)}>{STATUS_LABELS[activeMeeting.status]}</span>
                  </div>
                  <p className="field-hint">
                    {KIND_LABELS[activeMeeting.kind]} · {formatRoDateTime(activeMeeting.scheduledAt)}
                    {activeMeeting.location ? ` · ${activeMeeting.location}` : ""}
                  </p>
                  <div className="ssm-inline-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        downloadWithAuth(
                          ssmApi.getCssmConvocationUrl(activeMeeting.id),
                          `convocare-cssm-${activeMeeting.id}.pdf`
                        ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)))
                      }
                    >
                      Descarcă convocarea (PDF)
                    </button>
                    {activeMeeting.hasMinutes ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          downloadWithAuth(
                            ssmApi.getCssmMinutesUrl(activeMeeting.id),
                            `proces-verbal-cssm-${activeMeeting.id}.pdf`
                          ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)))
                        }
                      >
                        Descarcă proces-verbal (PDF)
                      </button>
                    ) : null}
                    {canEdit && activeMeeting.status !== "CANCELLED" && activeMeeting.status !== "HELD" ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={conveneMeeting.isPending}
                        onClick={() => conveneMeeting.mutate(activeMeeting.id)}
                      >
                        Convoacă
                      </button>
                    ) : null}
                    {canEdit && activeMeeting.status !== "CANCELLED" && activeMeeting.status !== "HELD" ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={holdMeeting.isPending}
                        onClick={() => holdMeeting.mutate(activeMeeting.id)}
                      >
                        Marchează ținută
                      </button>
                    ) : null}
                    {canEdit && activeMeeting.status !== "HELD" && activeMeeting.status !== "CANCELLED" ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={cancelMeeting.isPending}
                        onClick={() => cancelMeeting.mutate(activeMeeting.id)}
                      >
                        Anulează
                      </button>
                    ) : null}
                  </div>
                  {downloadError ? <p className="feedback error">{downloadError}</p> : null}

                  <h5 className="ssm-subtitle">Prezență</h5>
                  <div className="ssm-history-list">
                    {activeMeeting.attendees.map((attendee) => (
                      <div key={attendee.id} className="ssm-history-item">
                        <div>
                          <strong>{attendee.fullName}</strong>
                          <div className="field-hint">
                            {attendee.roleLabel ?? "Invitat"}
                            {attendee.present ? " · prezent" : " · absent"}
                            {attendee.hasSignature ? " · semnat" : ""}
                          </div>
                        </div>
                        {canEdit && activeMeeting.status !== "CANCELLED" ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              updateAttendee.mutate({
                                attendeeId: attendee.id,
                                payload: { present: !attendee.present }
                              })
                            }
                          >
                            {attendee.present ? "Marchează absent" : "Marchează prezent"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {!activeMeeting.attendees.length ? (
                      <p className="field-hint">Membrii vor fi copați automat la crearea ședinței.</p>
                    ) : null}
                  </div>

                  {canEdit && activeMeeting.status !== "CANCELLED" ? (
                    <div className="form-stack">
                      <label>Semnătură olografă (participant selectat din listă, aplicată ultimului marcat prezent)</label>
                      <SignatureCanvas value={signature} onChange={setSignature} />
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!signature || !activeMeeting.attendees.some((row) => row.present && !row.hasSignature)}
                        onClick={() => {
                          const target = activeMeeting.attendees.find((row) => row.present && !row.hasSignature);
                          if (!target) return;
                          updateAttendee.mutate({
                            attendeeId: target.id,
                            payload: { signature }
                          });
                        }}
                      >
                        Aplică semnătura următorului prezent
                      </button>
                    </div>
                  ) : null}

                  {canEdit && activeMeeting.status !== "CANCELLED" ? (
                    <form className="form-stack" onSubmit={onSaveMinutes}>
                      <h5 className="ssm-subtitle">Proces-verbal</h5>
                      <div className="field">
                        <label htmlFor="cssm-pv-number">Număr PV</label>
                        <input
                          id="cssm-pv-number"
                          value={minutesForm.number}
                          onChange={(event) => setMinutesForm((prev) => ({ ...prev, number: event.target.value }))}
                          placeholder="se generează automat dacă e gol"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cssm-pv-topics">Dezbatere / puncte discutate</label>
                        <textarea
                          id="cssm-pv-topics"
                          rows={5}
                          value={minutesForm.topics}
                          onChange={(event) => setMinutesForm((prev) => ({ ...prev, topics: event.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cssm-pv-decisions">Hotărâri / măsuri</label>
                        <textarea
                          id="cssm-pv-decisions"
                          rows={5}
                          value={minutesForm.decisions}
                          onChange={(event) => setMinutesForm((prev) => ({ ...prev, decisions: event.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cssm-pv-next">Următoarea ședință</label>
                        <input
                          id="cssm-pv-next"
                          type="date"
                          value={minutesForm.nextMeetingAt}
                          onChange={(event) => setMinutesForm((prev) => ({ ...prev, nextMeetingAt: event.target.value }))}
                        />
                      </div>
                      <button className="btn-primary" type="submit" disabled={saveMinutes.isPending}>
                        {saveMinutes.isPending ? "Se salvează…" : "Salvează proces-verbal"}
                      </button>
                      {saveMinutes.isError ? (
                        <p className="feedback error">{mutationErrorMessage(saveMinutes.error)}</p>
                      ) : null}
                      {saveMinutes.isSuccess ? (
                        <p className="feedback success">Proces-verbal salvat. Ședința este marcată ca ținută.</p>
                      ) : null}
                    </form>
                  ) : activeMeeting.minutes ? (
                    <>
                      <p className="field-hint">PV {activeMeeting.minutes.number}</p>
                      <p>{activeMeeting.minutes.topics || "—"}</p>
                      <p>{activeMeeting.minutes.decisions || "—"}</p>
                    </>
                  ) : null}
                </>
              )
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
