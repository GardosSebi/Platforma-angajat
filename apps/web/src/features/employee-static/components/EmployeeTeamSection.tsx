import type { EmployeeMyContextResponse, EmployeeTeamMemberSummary } from "@repo/shared-types";

function TeamMembersTable({ members }: { members: EmployeeTeamMemberSummary[] }) {
  if (members.length === 0) {
    return <p className="text-muted">Niciun membru activ în această echipă.</p>;
  }
  return (
    <table className="data-table team-members-table">
      <thead>
        <tr>
          <th scope="col">Nume</th>
          <th scope="col">E-mail</th>
          <th scope="col">Post</th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.id} className={m.isSelf ? "team-member-self" : undefined}>
            <td>
              {m.fullName}
              {m.isSelf ? <span className="team-self-badge">tu</span> : null}
            </td>
            <td>{m.email}</td>
            <td>{m.jobPositionName ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmployeeTeamSection({
  context,
  isLoading,
  error
}: {
  context: EmployeeMyContextResponse | undefined;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <section className="card" aria-labelledby="team-heading">
        <h2 id="team-heading">Echipa mea</h2>
        <p>Se încarcă…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card" aria-labelledby="team-heading">
        <h2 id="team-heading">Echipa mea</h2>
        <p className="feedback error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!context?.linked || !context.employee) {
    return (
      <section className="card" aria-labelledby="team-heading">
        <h2 id="team-heading">Echipa mea</h2>
        <p className="text-muted">
          Contul tău nu este legat de un profil de angajat (același e-mail ca la login). Contactează administratorul
          pentru alocare în departament sau grup.
        </p>
      </section>
    );
  }

  const { employee, departmentTeam, groups } = context;
  const hasTeam = Boolean(departmentTeam?.members.length) || groups.some((g) => g.members.length > 0);

  return (
    <section className="card team-context-card" aria-labelledby="team-heading">
      <h2 id="team-heading">Echipa mea</h2>
      {context.worksiteRestricted ? (
        <p className="field-hint">
          Sunt afișați doar colegii din același punct de lucru (conform rolului tău: responsabil SSM, manager sau
          angajat).
        </p>
      ) : null}
      <dl className="team-placement-dl">
        {employee.department ? (
          <>
            <dt>Departament</dt>
            <dd>{employee.department.name}</dd>
          </>
        ) : null}
        {employee.worksite ? (
          <>
            <dt>Punct de lucru</dt>
            <dd>{employee.worksite.name}</dd>
          </>
        ) : null}
        {employee.jobPosition ? (
          <>
            <dt>Post</dt>
            <dd>{employee.jobPosition.name}</dd>
          </>
        ) : null}
      </dl>

      {!hasTeam ? (
        <p className="text-muted">Nu ești alocat încă unui departament sau grup de angajați.</p>
      ) : null}

      {departmentTeam ? (
        <div className="team-block">
          <h3 className="team-block-title">Colegi din departament: {departmentTeam.department.name}</h3>
          <TeamMembersTable members={departmentTeam.members} />
        </div>
      ) : null}

      {groups.map((g) => (
        <div key={g.id} className="team-block">
          <h3 className="team-block-title">Grup: {g.name}</h3>
          {g.description ? <p className="field-hint">{g.description}</p> : null}
          <TeamMembersTable members={g.members} />
        </div>
      ))}
    </section>
  );
}
