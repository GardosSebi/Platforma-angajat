import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  SsmCalendarSource,
  SsmOrgTrafficItem,
  SsmOverviewFilters,
  SsmUnifiedCalendarEvent
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import {
  useDepartmentsLookup,
  useLegalEntitiesLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { useSsmComplianceDashboard, useUnifiedSsmCalendar } from "../hooks/useSsmOverview";
import { ssmApi } from "../api/ssm.api";

type OverviewTab = "status" | "calendar" | "overdue" | "traffic";

const OVERVIEW_TABS: Array<{ id: OverviewTab; title: string; caption: string }> = [
  { id: "status", title: "Situație", caption: "KPI și breakdown" },
  { id: "calendar", title: "Calendar", caption: "Evenimente SSM" },
  { id: "overdue", title: "Restanțe", caption: "Angajați neconformi" },
  { id: "traffic", title: "Semafor", caption: "Entitate / departament" }
];

const SOURCE_LABELS: Record<SsmCalendarSource, string> = {
  TRAINING: "Instruire",
  MEDICAL: "Medical",
  EIP: "EIP",
  PSI: "PSI",
  PSI_TRAINING: "Instruire PSI",
  EVACUATION_DRILL: "Simulare evacuare"
};

const SOURCE_OPTIONS: Array<{ value: SsmCalendarSource; label: string }> = (
  Object.entries(SOURCE_LABELS) as Array<[SsmCalendarSource, string]>
).map(([value, label]) => ({ value, label }));

const TRAFFIC_LABELS: Record<string, string> = {
  GREEN: "Verde",
  YELLOW: "Galben",
  RED: "Roșu"
};

const TRAFFIC_CHIP: Record<string, string> = {
  GREEN: "good",
  YELLOW: "warn",
  RED: "bad"
};

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

type FilterState = {
  legalEntityId: string;
  worksiteId: string;
  departmentId: string;
  employeeId: string;
  source: SsmCalendarSource | "";
  from: string;
  to: string;
};

const EMPTY_FILTERS: FilterState = {
  legalEntityId: "",
  worksiteId: "",
  departmentId: "",
  employeeId: "",
  source: "",
  from: "",
  to: ""
};

function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ro-RO");
}

function toIsoDay(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function eventDayKey(event: SsmUnifiedCalendarEvent): string {
  return toIsoDay(new Date(event.dueAt ?? event.startAt));
}

function buildMonthCells(month: Date): Array<{ date: Date; inMonth: boolean }> {
  const first = startOfMonth(month);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

function toApiFilters(filters: FilterState): SsmOverviewFilters {
  return {
    legalEntityId: filters.legalEntityId || undefined,
    worksiteId: filters.worksiteId || undefined,
    departmentId: filters.departmentId || undefined,
    employeeId: filters.employeeId || undefined,
    source: filters.source || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined
  };
}

function activeFilterCount(filters: FilterState): number {
  return Object.values(filters).filter(Boolean).length;
}

function TrafficList({
  items,
  onSelect
}: {
  items: SsmOrgTrafficItem[];
  onSelect: (id: string) => void;
}) {
  if (!items.length) {
    return <p className="field-hint">Nu există date pe această dimensiune.</p>;
  }

  return (
    <div className="ssm-history-list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="ssm-history-item ssm-overview-traffic-row"
          onClick={() => onSelect(item.id)}
        >
          <div>
            <strong>{item.name}</strong>
            <div className="field-hint">
              {item.compliantEmployees}/{item.employeeCount} conformi · {item.overdueEmployees} restanțe
            </div>
            <div className="ssm-progress" aria-label={`Scor ${item.name} ${item.score}%`}>
              <span style={{ width: `${Math.max(0, Math.min(item.score, 100))}%` }} />
            </div>
          </div>
          <span className={`ssm-chip ${TRAFFIC_CHIP[item.trafficLight]}`}>
            {item.score}% · {TRAFFIC_LABELS[item.trafficLight]}
          </span>
        </button>
      ))}
    </div>
  );
}

export function SsmComplianceDashboardManager() {
  const [tab, setTab] = useState<OverviewTab>("status");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(() => toIsoDay(new Date()));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const calendarQuery = useUnifiedSsmCalendar(apiFilters);
  const dashboardQuery = useSsmComplianceDashboard(apiFilters);

  const legalEntities = useLegalEntitiesLookup();
  const worksites = useWorksitesLookup();
  const departments = useDepartmentsLookup();

  const activeTabMeta = OVERVIEW_TABS.find((item) => item.id === tab) ?? OVERVIEW_TABS[0];
  const filterCount = activeFilterCount(filters);

  const worksiteOptions = useMemo(() => {
    const items = worksites.data?.items ?? [];
    return filters.legalEntityId
      ? items.filter((item) => item.legalEntityId === filters.legalEntityId)
      : items;
  }, [filters.legalEntityId, worksites.data?.items]);

  const departmentOptions = useMemo(() => {
    const items = departments.data?.items ?? [];
    return filters.worksiteId ? items.filter((item) => item.worksiteId === filters.worksiteId) : items;
  }, [departments.data?.items, filters.worksiteId]);

  const events = calendarQuery.data?.events ?? [];
  const eventsByDay = useMemo(() => {
    const map = new Map<string, SsmUnifiedCalendarEvent[]>();
    for (const event of events) {
      const key = eventDayKey(event);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const monthCells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const selectedDayEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];
  const kpi = dashboardQuery.data?.kpi;
  const overdueEmployees = dashboardQuery.data?.overdueEmployees ?? [];
  const selectedEmployee = overdueEmployees.find((item) => item.employeeId === selectedEmployeeId) ?? null;
  const monthEventCount = useMemo(
    () =>
      events.filter((event) => {
        const day = new Date(event.dueAt ?? event.startAt);
        return day.getMonth() === viewMonth.getMonth() && day.getFullYear() === viewMonth.getFullYear();
      }).length,
    [events, viewMonth]
  );

  const patchFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.legalEntityId !== undefined) {
        next.worksiteId = "";
        next.departmentId = "";
      }
      if (patch.worksiteId !== undefined) {
        next.departmentId = "";
      }
      return next;
    });
  };

  const focusEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    patchFilter({ employeeId });
    setTab("overdue");
  };

  const openDayAndStay = (day: string) => {
    setSelectedDay(day);
  };

  return (
    <section className="ssm-eip-panel ssm-overview-panel" aria-label="Calendar și conformitate SSM">
      <div className="ssm-training-metrics ssm-overview-metrics" aria-label="Indicatori conformitate">
        <div>
          <dt>Conformitate</dt>
          <dd className={kpi ? `traffic-${kpi.trafficLight.toLowerCase()}` : undefined}>
            {kpi ? `${kpi.globalScore}%` : "—"}
          </dd>
        </div>
        <div>
          <dt>La zi</dt>
          <dd>{kpi ? `${kpi.compliantEmployees}/${kpi.totalEmployees}` : "—"}</dd>
        </div>
        <div>
          <dt>Restanțe</dt>
          <dd>{kpi?.overdueEmployees ?? "—"}</dd>
        </div>
        <div>
          <dt>Verificări</dt>
          <dd>{kpi ? `${kpi.checksScore}%` : "—"}</dd>
        </div>
      </div>

      <div className="ssm-panel-tabs" role="tablist" aria-label="Secțiuni calendar și conformitate">
        {OVERVIEW_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ssm-panel-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </button>
        ))}
      </div>

      <header className="ssm-panel-header ssm-overview-toolbar">
        <div>
          <h3 className="card-title">{activeTabMeta.title}</h3>
          <p className="field-hint">{activeTabMeta.caption}</p>
        </div>
        <div className="ssm-inline-actions">
          <button
            type="button"
            className={`btn-secondary${showFilters || filterCount ? " is-active-filter" : ""}`}
            onClick={() => setShowFilters((value) => !value)}
          >
            Filtre{filterCount ? ` (${filterCount})` : ""}
          </button>
          {tab === "calendar" ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void downloadWithAuth(ssmApi.getCalendarIcalUrl(apiFilters), "ssm-calendar.ics").catch(
                    () => undefined
                  );
                }}
              >
                iCal
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void downloadWithAuth(ssmApi.getCalendarPdfUrl(apiFilters), "ssm-calendar.pdf").catch(
                    () => undefined
                  );
                }}
              >
                PDF
              </button>
            </>
          ) : null}
        </div>
      </header>

      {showFilters ? (
        <div className="card form-stack ssm-doc-card ssm-overview-filters">
          <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
            <h4 className="card-title" style={{ margin: 0 }}>
              Filtre active
            </h4>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setSelectedEmployeeId(null);
              }}
            >
              Resetează
            </button>
          </div>
          <div className="ssm-filter-grid">
            <FieldSelect
              id="ov-legal-entity"
              label="Entitate"
              value={filters.legalEntityId}
              onChange={(legalEntityId) => patchFilter({ legalEntityId })}
              allowEmpty
              emptyLabel="Toate entitățile"
              options={mapToOptions(
                legalEntities.data?.items ?? [],
                (item) => item.id,
                (item) => `${item.code} — ${item.name}`
              )}
            />
            <FieldSelect
              id="ov-worksite"
              label="Punct de lucru"
              value={filters.worksiteId}
              onChange={(worksiteId) => patchFilter({ worksiteId })}
              allowEmpty
              emptyLabel="Toate punctele"
              options={mapToOptions(
                worksiteOptions,
                (item) => item.id,
                (item) => `${item.code} — ${item.name}`
              )}
            />
            <FieldSelect
              id="ov-department"
              label="Departament"
              value={filters.departmentId}
              onChange={(departmentId) => patchFilter({ departmentId })}
              allowEmpty
              emptyLabel="Toate departamentele"
              options={mapToOptions(
                departmentOptions,
                (item) => item.id,
                (item) => `${item.code} — ${item.name}`
              )}
            />
            <EmployeeSelect
              id="ov-employee"
              label="Angajat"
              value={filters.employeeId}
              onChange={(employeeId) => {
                patchFilter({ employeeId });
                setSelectedEmployeeId(employeeId || null);
              }}
              allowEmpty
              emptyLabel="Toți angajații"
            />
            {tab === "calendar" ? (
              <>
                <FieldSelect
                  id="ov-source"
                  label="Tip eveniment"
                  value={filters.source}
                  onChange={(source) => patchFilter({ source: source as SsmCalendarSource | "" })}
                  allowEmpty
                  emptyLabel="Toate tipurile"
                  options={SOURCE_OPTIONS}
                />
                <label className="field">
                  <span>De la</span>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(event) => patchFilter({ from: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Până la</span>
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(event) => patchFilter({ to: event.target.value })}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "status" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Breakdown pe module
              </h4>
              <span className={`ssm-chip ${kpi ? TRAFFIC_CHIP[kpi.trafficLight] : ""}`}>
                {kpi ? TRAFFIC_LABELS[kpi.trafficLight] : "—"}
              </span>
            </div>
            {dashboardQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
            <div className="ssm-history-list">
              {(dashboardQuery.data?.breakdown ?? []).map((item) => (
                <div key={item.module} className="ssm-history-item">
                  <div style={{ flex: 1 }}>
                    <strong>
                      {item.module} · {item.score}%
                    </strong>
                    <div className="field-hint">
                      conforme {item.compliant}/{item.total} · neconforme {item.noncompliant}
                    </div>
                    <div className="ssm-progress" aria-label={`Scor ${item.module} ${item.score}%`}>
                      <span style={{ width: `${Math.max(0, Math.min(item.score, 100))}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {!dashboardQuery.isLoading && !(dashboardQuery.data?.breakdown.length ?? 0) ? (
                <p className="field-hint">Nu există date de conformitate.</p>
              ) : null}
            </div>
          </div>

          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Top neconformități
              </h4>
              <button type="button" className="btn-text" onClick={() => setTab("overdue")}>
                Vezi restanțe
              </button>
            </div>
            <div className="ssm-history-list">
              {(dashboardQuery.data?.topNonconformities ?? []).map((item) => (
                <div key={item.module} className="ssm-history-item">
                  <div>
                    <strong>{item.module}</strong>
                    <div className="field-hint">
                      {item.count} neconformități · scor {item.score}%
                    </div>
                  </div>
                  <span className="ssm-chip bad">{item.count}</span>
                </div>
              ))}
              {!dashboardQuery.isLoading && (dashboardQuery.data?.topNonconformities.length ?? 0) === 0 ? (
                <p className="field-hint">Nu există neconformități active.</p>
              ) : null}
            </div>

            <div className="ssm-overview-quick">
              <button type="button" className="btn-secondary" onClick={() => setTab("calendar")}>
                Deschide calendar
              </button>
              <button type="button" className="btn-secondary" onClick={() => setTab("traffic")}>
                Semafor organizație
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="ssm-panel-layout ssm-overview-calendar-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                {monthLabel(viewMonth)}
              </h4>
              <div className="ssm-inline-actions">
                <button type="button" className="btn-text" onClick={() => setViewMonth((m) => addMonths(m, -1))}>
                  ←
                </button>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    const today = startOfMonth(new Date());
                    setViewMonth(today);
                    setSelectedDay(toIsoDay(new Date()));
                  }}
                >
                  Azi
                </button>
                <button type="button" className="btn-text" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
                  →
                </button>
              </div>
            </div>
            <p className="field-hint" style={{ margin: 0 }}>
              {monthEventCount} evenimente în lună · {events.length} în filtrul curent
            </p>
            {calendarQuery.isLoading ? <p className="field-hint">Se încarcă calendarul…</p> : null}

            <div className="ssm-month-calendar" role="grid" aria-label="Calendar SSM">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="ssm-month-weekday">
                  {label}
                </div>
              ))}
              {monthCells.map(({ date, inMonth }) => {
                const key = toIsoDay(date);
                const dayEvents = eventsByDay.get(key) ?? [];
                const isSelected = selectedDay === key;
                const isToday = key === toIsoDay(new Date());
                return (
                  <button
                    key={key}
                    type="button"
                    className={`ssm-month-day${inMonth ? "" : " muted"}${isSelected ? " selected" : ""}${
                      isToday ? " today" : ""
                    }${dayEvents.length ? " has-events" : ""}`}
                    onClick={() => openDayAndStay(key)}
                  >
                    <span className="ssm-month-day-num">{date.getDate()}</span>
                    {dayEvents.length > 0 ? (
                      <span className="ssm-month-day-count">{dayEvents.length}</span>
                    ) : null}
                    <span className="ssm-month-day-dots" aria-hidden>
                      {dayEvents.slice(0, 3).map((event) => (
                        <i key={`${event.source}-${event.id}`} data-source={event.source} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="ssm-overview-legend">
              {SOURCE_OPTIONS.map((source) => (
                <span key={source.value}>
                  <i data-source={source.value} /> {source.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                {selectedDay ? formatDate(selectedDay) : "Selectează o zi"}
              </h4>
              <span className="ssm-chip">{selectedDayEvents.length}</span>
            </div>
            <div className="ssm-history-list">
              {selectedDayEvents.map((event) => (
                <div key={`${event.source}-${event.id}`} className="ssm-history-item">
                  <div>
                    <strong>
                      {SOURCE_LABELS[event.source] ?? event.source} · {event.title}
                    </strong>
                    <div className="field-hint">
                      scadență {formatDate(event.dueAt)} · {event.status}
                      {event.ownerLabel ? ` · ${event.ownerLabel}` : ""}
                    </div>
                  </div>
                  {event.employeeId ? (
                    <button type="button" className="btn-text" onClick={() => focusEmployee(event.employeeId!)}>
                      Restanțe
                    </button>
                  ) : null}
                </div>
              ))}
              {selectedDay && selectedDayEvents.length === 0 ? (
                <p className="field-hint">Niciun eveniment în această zi.</p>
              ) : null}
              {!selectedDay ? <p className="field-hint">Apasă pe o zi din calendar.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "overdue" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Angajați cu restanțe
              </h4>
              <span className="ssm-chip bad">{overdueEmployees.length}</span>
            </div>
            {dashboardQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
            <div className="ssm-history-list">
              {overdueEmployees.map((item) => (
                <button
                  key={item.employeeId}
                  type="button"
                  className={`ssm-history-item ssm-overview-select-row${
                    selectedEmployeeId === item.employeeId ? " selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedEmployeeId(item.employeeId);
                    patchFilter({ employeeId: item.employeeId });
                  }}
                >
                  <div>
                    <strong>{item.fullName}</strong>
                    <div className="field-hint">
                      {item.outstandingCount} restanțe · max {item.maxDaysOverdue} zile · {item.modules.join(", ")}
                    </div>
                    <div className="field-hint">
                      {[item.departmentName, item.worksiteName].filter(Boolean).join(" · ") || "Fără plasare"}
                    </div>
                  </div>
                  <span className="ssm-chip bad">{item.maxDaysOverdue}z</span>
                </button>
              ))}
              {!dashboardQuery.isLoading && overdueEmployees.length === 0 ? (
                <p className="field-hint">Nu există angajați cu restanțe în filtrul curent.</p>
              ) : null}
            </div>
          </div>

          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                {selectedEmployee ? selectedEmployee.fullName : "Detalii restanțe"}
              </h4>
              {selectedEmployee ? (
                <Link className="btn-text" to="/master-data">
                  Master Data
                </Link>
              ) : null}
            </div>
            {selectedEmployee ? (
              <>
                <p className="field-hint" style={{ marginTop: 0 }}>
                  {[selectedEmployee.departmentName, selectedEmployee.worksiteName, selectedEmployee.legalEntityName]
                    .filter(Boolean)
                    .join(" · ") || "Fără plasare"}
                </p>
                <div className="ssm-history-list">
                  {selectedEmployee.items.map((item) => (
                    <div key={`${item.module}-${item.id}`} className="ssm-history-item">
                      <div>
                        <strong>
                          {item.module} · {item.title}
                        </strong>
                        <div className="field-hint">
                          {formatDate(item.dueAt)} · {item.daysOverdue} zile · {item.severity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ssm-overview-quick">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setTab("calendar");
                    }}
                  >
                    Vezi în calendar
                  </button>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      patchFilter({ employeeId: "" });
                      setSelectedEmployeeId(null);
                    }}
                  >
                    Curăță selecția
                  </button>
                </div>
              </>
            ) : (
              <p className="field-hint">Selectează un angajat din listă pentru a vedea cerințele restante.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "traffic" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Pe entitate
              </h4>
              <span className="ssm-chip">{dashboardQuery.data?.byEntity.length ?? 0}</span>
            </div>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Verde ≥90% · Galben ≥75% · Roșu &lt;75%. Click filtrează.
            </p>
            <TrafficList
              items={dashboardQuery.data?.byEntity ?? []}
              onSelect={(legalEntityId) => {
                patchFilter({ legalEntityId });
                setShowFilters(true);
                setTab("status");
              }}
            />
          </div>

          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Pe departament
              </h4>
              <span className="ssm-chip">{dashboardQuery.data?.byDepartment.length ?? 0}</span>
            </div>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Click pe un departament pentru a filtra restul dashboard-ului.
            </p>
            <TrafficList
              items={dashboardQuery.data?.byDepartment ?? []}
              onSelect={(departmentId) => {
                patchFilter({ departmentId });
                setShowFilters(true);
                setTab("overdue");
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
