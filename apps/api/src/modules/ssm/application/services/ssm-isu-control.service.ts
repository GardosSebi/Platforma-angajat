import { access, readFile } from "fs/promises";
import { constants } from "fs";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SsmDocumentStatus,
  SsmDocumentTargetType,
  SsmDocumentType,
  SsmPsiEquipmentCategory,
  SsmPsiEquipmentStatus,
  SsmPsiResponsibleRole,
  SsmTrainingCategory,
  SsmTrainingPlanStatus
} from "@prisma/client";
import JSZip from "jszip";
import { JwtPayload } from "../../../../auth/jwt.strategy";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { renderIsuControlSummary } from "../legal-forms";
import { classifyPsiDocument, PsiDocKind } from "./ssm-psi.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 30;
const DEFAULT_PSI_RECURRENCE_DAYS = 365;
const DRILL_MAX_INTERVAL_DAYS = 365;
const REQUIRED_ROLES: SsmPsiResponsibleRole[] = [
  SsmPsiResponsibleRole.PSI_RESPONSIBLE,
  SsmPsiResponsibleRole.EVACUATION_RESPONSIBLE
];

const ROLE_LABELS: Record<SsmPsiResponsibleRole, string> = {
  PSI_RESPONSIBLE: "Responsabil PSI",
  EMERGENCY_COORDINATOR: "Coordonator situații de urgență",
  EVACUATION_RESPONSIBLE: "Responsabil evacuare",
  FIRST_AID_RESPONSIBLE: "Responsabil prim ajutor"
};

const CATEGORY_LABELS: Record<SsmPsiEquipmentCategory, string> = {
  EXTINGUISHER: "Stingător",
  HYDRANT: "Hidrant",
  DETECTION_SYSTEM: "Sistem detecție",
  OTHER: "Altele"
};

type Traffic = "GREEN" | "YELLOW" | "RED";

type WorksiteDoc = {
  id: string;
  title: string;
  kind: PsiDocKind;
  storagePath: string | null;
  fileName: string | null;
  versionNumber: number | null;
};

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function safePath(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
}

@Injectable()
export class SsmIsuControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  async readiness(tenantId: string, worksiteId?: string) {
    const data = await this.load(tenantId, worksiteId);
    const items = data.worksites.map((site) => this.evaluate(site, data, new Date()).readiness);
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        worksites: items.length,
        averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0,
        green: items.filter((item) => item.traffic === "GREEN").length,
        yellow: items.filter((item) => item.traffic === "YELLOW").length,
        red: items.filter((item) => item.traffic === "RED").length
      },
      items
    };
  }

  async exportPackage(tenantId: string, viewer: JwtPayload, worksiteId?: string) {
    const data = await this.load(tenantId, worksiteId);
    const now = new Date();
    const evaluated = data.worksites.map((site) => ({ site, ...this.evaluate(site, data, now) }));
    const zip = new JSZip();
    const warnings: string[] = [];
    let files = 0;

    const [tenant, actor] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      this.prisma.user.findFirst({ where: { id: viewer.sub }, select: { email: true } })
    ]);

    zip.file(
      "00-Sumar-control-ISU.pdf",
      await renderIsuControlSummary({
        tenantName: tenant?.name ?? null,
        generatedAt: now,
        generatedBy: actor?.email ?? null,
        worksites: evaluated.map(({ readiness, overdueEquipment }) => ({
          code: readiness.worksiteCode,
          name: readiness.worksiteName,
          legalEntityName: readiness.legalEntityName,
          score: readiness.score,
          traffic: readiness.traffic,
          documents: readiness.documents,
          equipment: readiness.equipment,
          drills: readiness.drills,
          personnel: readiness.personnel,
          responsibles: readiness.responsibles.roles.map((row) => ({
            label: ROLE_LABELS[row.role],
            persons: row.persons
          })),
          gaps: readiness.gaps,
          overdueEquipment
        }))
      })
    );

    const addStoredFile = async (path: string | null, zipPath: string, label: string) => {
      if (!path) {
        warnings.push(`Fără fișier atașat: ${label}`);
        return;
      }
      try {
        await access(path, constants.R_OK);
        zip.file(zipPath, await readFile(path));
        files += 1;
      } catch {
        warnings.push(`Lipsește fișierul de pe disc: ${label}`);
      }
    };

    const added = new Set<string>();
    for (const { site, docs } of evaluated) {
      const folder = safePath(`${site.code}-${site.name}`);
      for (const doc of docs) {
        const key = `${folder}|${doc.id}`;
        if (added.has(key)) continue;
        added.add(key);
        await addStoredFile(
          doc.storagePath,
          `documente/${folder}/${safePath(`${doc.kind}-${doc.title}-v${doc.versionNumber ?? 1}-${doc.fileName ?? "document.pdf"}`)}`,
          doc.title
        );
      }
    }

    const equipmentRows = data.equipment.map((item) => [
      item.worksite.code,
      item.worksite.name,
      item.code,
      item.name,
      CATEGORY_LABELS[item.category],
      item.serialNumber,
      item.location,
      item.verificationIntervalDays,
      item.lastVerifiedAt,
      item.nextDueAt,
      item.nextDueAt && item.nextDueAt < now ? "EXPIRAT" : item.lastVerifiedAt ? "CONFORM" : "NEVERIFICAT"
    ]);
    zip.file(
      "registre/01-mijloace-stingere.csv",
      toCsv(
        [
          "Cod punct",
          "Punct de lucru",
          "Cod",
          "Denumire",
          "Categorie",
          "Serie",
          "Amplasament",
          "Interval verificare (zile)",
          "Ultima verificare",
          "Scadență",
          "Stare"
        ],
        equipmentRows
      )
    );

    const verifications = await this.prisma.ssmPsiEquipmentVerification.findMany({
      where: { tenantId, equipmentId: { in: data.equipment.map((item) => item.id) } },
      include: { equipment: { select: { code: true, name: true, worksite: { select: { code: true } } } } },
      orderBy: { performedAt: "desc" }
    });
    zip.file(
      "registre/02-verificari-stingatoare.csv",
      toCsv(
        ["Cod punct", "Cod echipament", "Echipament", "Data verificării", "Următoarea scadență", "Rezultat", "Observații"],
        verifications.map((row) => [
          row.equipment.worksite.code,
          row.equipment.code,
          row.equipment.name,
          row.performedAt,
          row.nextDueAt,
          row.result,
          row.notes
        ])
      )
    );

    zip.file(
      "registre/03-simulari-evacuare.csv",
      toCsv(
        ["Cod punct", "Punct de lucru", "Data", "Durată (min)", "Participanți", "Rezultat", "Coordonator", "Următoarea", "Observații"],
        data.drills.map((row) => [
          row.worksite.code,
          row.worksite.name,
          row.conductedAt,
          row.durationMinutes,
          row.participantsCount,
          row.result,
          row.coordinatorName,
          row.nextDueAt,
          row.notes
        ])
      )
    );

    zip.file(
      "registre/04-personal-instruit-psi.csv",
      toCsv(
        ["Cod punct", "Punct de lucru", "Angajat", "Instruit PSI", "Sursă", "Data instruirii", "Valabil până la"],
        evaluated.flatMap(({ site, personnelRows }) =>
          personnelRows.map((row) => [
            site.code,
            site.name,
            row.fullName,
            row.trained ? "DA" : "NU",
            row.source,
            row.conductedAt,
            row.validUntil
          ])
        )
      )
    );

    zip.file(
      "registre/05-persoane-desemnate-psi.csv",
      toCsv(
        ["Cod punct", "Punct de lucru", "Rol", "Persoană", "Email", "Telefon"],
        data.responsibles.map((row) => [
          row.worksite.code,
          row.worksite.name,
          ROLE_LABELS[row.role],
          row.personName,
          row.email,
          row.phone
        ])
      )
    );

    const evidenceIds = [
      ...new Set(
        [
          ...verifications.map((row) => row.documentId),
          ...data.psiRecords.map((row) => row.evidenceDocumentId)
        ].filter((id): id is string => Boolean(id))
      )
    ];
    if (evidenceIds.length) {
      const evidence = await this.prisma.ssmDocument.findMany({
        where: { tenantId, id: { in: evidenceIds } },
        include: { activeVersion: true }
      });
      for (const doc of evidence) {
        await addStoredFile(
          doc.activeVersion?.storagePath ?? null,
          `dovezi/${safePath(`${doc.title}-${doc.activeVersion?.fileName ?? "document.pdf"}`)}`,
          doc.title
        );
      }
    }

    zip.file(
      "manifest.txt",
      [
        "Pachet control ISU (apărarea împotriva incendiilor)",
        `Generat: ${now.toISOString()}`,
        `Punct de lucru: ${worksiteId ? evaluated[0]?.site.name ?? worksiteId : "toate"}`,
        `Fișiere documente/dovezi incluse: ${files}`,
        "",
        "Conținut:",
        "- 00-Sumar-control-ISU.pdf — situația pe puncte de lucru, scor de pregătire și neconformități",
        "- documente/ — instrucțiuni PSI, plan de evacuare, plan de intervenție (versiunea aprobată activă)",
        "- registre/ — mijloace de stingere, verificări, simulări de evacuare, personal instruit PSI, persoane desemnate",
        "- dovezi/ — procese-verbale atașate verificărilor și instruirilor PSI"
      ].join("\r\n")
    );
    if (warnings.length) {
      zip.file("warnings.txt", warnings.map((line) => `- ${line}`).join("\r\n"));
    }

    await this.auditLog.write({
      tenantId,
      actorId: viewer.sub,
      module: "SSM",
      action: "ISU_CONTROL_PACKAGE_EXPORTED",
      entityType: "IsuControlPackage",
      entityId: worksiteId ?? "all",
      payload: {
        worksites: evaluated.length,
        files,
        warnings: warnings.length,
        averageScore: evaluated.length
          ? Math.round(evaluated.reduce((sum, row) => sum + row.readiness.score, 0) / evaluated.length)
          : 0
      }
    });

    const suffix = worksiteId ? safePath(evaluated[0]?.site.code ?? worksiteId) : "toate";
    return {
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
      fileName: `Pachet-control-ISU-${suffix}-${now.toISOString().slice(0, 10)}.zip`
    };
  }

  private async load(tenantId: string, worksiteId?: string) {
    const worksites = await this.prisma.worksite.findMany({
      where: { tenantId, active: true, ...(worksiteId ? { id: worksiteId } : {}) },
      include: { legalEntity: { select: { name: true } } },
      orderBy: { code: "asc" }
    });
    if (worksiteId && !worksites.length) throw new NotFoundException("Punctul de lucru nu a fost găsit.");
    const worksiteIds = worksites.map((site) => site.id);

    const [documents, equipment, drills, psiRecords, responsibles, employees] = await Promise.all([
      this.prisma.ssmDocument.findMany({
        where: {
          tenantId,
          type: { in: [SsmDocumentType.PSI, SsmDocumentType.EMERGENCY_PROCEDURE] },
          status: SsmDocumentStatus.APPROVED,
          targetType: { in: [SsmDocumentTargetType.WORKSITE, SsmDocumentTargetType.ALL] }
        },
        include: { activeVersion: true },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.ssmPsiEquipment.findMany({
        where: { tenantId, worksiteId: { in: worksiteIds }, status: SsmPsiEquipmentStatus.ACTIVE },
        include: { worksite: { select: { code: true, name: true } } },
        orderBy: [{ worksiteId: "asc" }, { code: "asc" }]
      }),
      this.prisma.ssmEvacuationDrill.findMany({
        where: { tenantId, worksiteId: { in: worksiteIds } },
        include: { worksite: { select: { code: true, name: true } } },
        orderBy: { conductedAt: "desc" }
      }),
      this.prisma.ssmPsiTrainingRecord.findMany({
        where: { tenantId, worksiteId: { in: worksiteIds } },
        orderBy: { conductedAt: "desc" }
      }),
      this.prisma.ssmPsiResponsible.findMany({
        where: { tenantId, worksiteId: { in: worksiteIds }, active: true },
        include: { worksite: { select: { code: true, name: true } } },
        orderBy: [{ worksiteId: "asc" }, { role: "asc" }]
      }),
      this.prisma.employee.findMany({
        where: { tenantId, active: true, dsarErasedAt: null, worksiteId: { in: worksiteIds } },
        select: { id: true, fullName: true, worksiteId: true },
        orderBy: { fullName: "asc" }
      })
    ]);

    const psiPlans = employees.length
      ? await this.prisma.ssmTrainingPlan.findMany({
          where: {
            tenantId,
            employeeId: { in: employees.map((row) => row.id) },
            status: SsmTrainingPlanStatus.COMPLETED,
            completedAt: { not: null },
            trainingType: { category: SsmTrainingCategory.EMERGENCY_PSI }
          },
          select: { employeeId: true, completedAt: true, trainingType: { select: { recurrenceDays: true } } },
          orderBy: { completedAt: "desc" }
        })
      : [];

    return { worksites, documents, equipment, drills, psiRecords, responsibles, employees, psiPlans };
  }

  private evaluate(
    site: Awaited<ReturnType<SsmIsuControlService["load"]>>["worksites"][number],
    data: Awaited<ReturnType<SsmIsuControlService["load"]>>,
    now: Date
  ) {
    const siteName = site.name.trim().toLowerCase();
    const siteCode = site.code.trim().toLowerCase();
    const docs: WorksiteDoc[] = data.documents
      .filter((doc) => {
        if (doc.targetType === SsmDocumentTargetType.ALL) return true;
        if (doc.targetRefId === site.id) return true;
        const label = (doc.targetLabel ?? "").trim().toLowerCase();
        return Boolean(label) && (label === siteName || label === siteCode);
      })
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        kind: classifyPsiDocument(doc.type, doc.title),
        storagePath: doc.activeVersion?.storagePath ?? null,
        fileName: doc.activeVersion?.fileName ?? null,
        versionNumber: doc.activeVersion?.versionNumber ?? null
      }));
    const documents = {
      instructions: docs.some((doc) => doc.kind === "INSTRUCTIONS"),
      evacuationPlan: docs.some((doc) => doc.kind === "EVACUATION_PLAN"),
      intervention: docs.some((doc) => doc.kind === "INTERVENTION"),
      count: docs.length
    };

    const siteEquipment = data.equipment.filter((item) => item.worksiteId === site.id);
    const soon = new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS);
    const byCategory = Object.fromEntries(
      Object.values(SsmPsiEquipmentCategory).map((category) => [category, 0])
    ) as Record<SsmPsiEquipmentCategory, number>;
    let ok = 0;
    let dueSoon = 0;
    let overdue = 0;
    let neverVerified = 0;
    const overdueEquipment: Array<{ code: string; name: string; location: string | null; nextDueAt: string | null }> = [];
    for (const item of siteEquipment) {
      byCategory[item.category] += 1;
      if (item.nextDueAt && item.nextDueAt < now) {
        overdue += 1;
        overdueEquipment.push({
          code: item.code,
          name: item.name,
          location: item.location,
          nextDueAt: item.nextDueAt.toISOString()
        });
      } else if (!item.lastVerifiedAt) {
        neverVerified += 1;
      } else if (item.nextDueAt && item.nextDueAt <= soon) {
        dueSoon += 1;
      } else {
        ok += 1;
      }
    }

    const siteDrills = data.drills.filter((row) => row.worksiteId === site.id);
    const lastDrill = siteDrills[0] ?? null;
    const drillNextDue =
      lastDrill?.nextDueAt ?? (lastDrill ? new Date(lastDrill.conductedAt.getTime() + DRILL_MAX_INTERVAL_DAYS * DAY_MS) : null);
    const drillsOverdue = !lastDrill || Boolean(drillNextDue && drillNextDue < now);
    const yearAgo = new Date(now.getTime() - 365 * DAY_MS);

    const siteEmployees = data.employees.filter((row) => row.worksiteId === site.id);
    const personnelRows = siteEmployees.map((employee) => {
      const record = data.psiRecords.find(
        (row) => row.employeeId === employee.id && (!row.validUntil || row.validUntil >= now)
      );
      if (record) {
        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          trained: true,
          source: "Registru PSI",
          conductedAt: record.conductedAt,
          validUntil: record.validUntil
        };
      }
      const plan = data.psiPlans.find((row) => {
        if (row.employeeId !== employee.id || !row.completedAt) return false;
        const days = row.trainingType.recurrenceDays ?? DEFAULT_PSI_RECURRENCE_DAYS;
        return row.completedAt.getTime() + days * DAY_MS >= now.getTime();
      });
      if (plan?.completedAt) {
        const days = plan.trainingType.recurrenceDays ?? DEFAULT_PSI_RECURRENCE_DAYS;
        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          trained: true,
          source: "Instruire SSM (situații de urgență/PSI)",
          conductedAt: plan.completedAt,
          validUntil: new Date(plan.completedAt.getTime() + days * DAY_MS)
        };
      }
      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        trained: false,
        source: "",
        conductedAt: null as Date | null,
        validUntil: null as Date | null
      };
    });
    const trained = personnelRows.filter((row) => row.trained).length;
    const coveragePercent = siteEmployees.length ? Math.round((trained / siteEmployees.length) * 100) : 100;

    const siteResponsibles = data.responsibles.filter((row) => row.worksiteId === site.id);
    const roles = Object.values(SsmPsiResponsibleRole).map((role) => ({
      role,
      persons: siteResponsibles.filter((row) => row.role === role).map((row) => row.personName)
    }));
    const missingRequired = REQUIRED_ROLES.filter((role) => !roles.find((row) => row.role === role)?.persons.length);

    const gaps: string[] = [];
    if (!documents.evacuationPlan) gaps.push("Lipsește planul de evacuare aprobat pentru punctul de lucru.");
    if (!documents.instructions) gaps.push("Lipsesc instrucțiunile proprii PSI aprobate.");
    if (!documents.intervention) gaps.push("Lipsește planul de intervenție / organizarea în situații de urgență.");
    if (!siteEquipment.length) gaps.push("Nu este înregistrat niciun mijloc de stingere.");
    if (overdue) gaps.push(`${overdue} mijloace de stingere au verificarea expirată.`);
    if (neverVerified) gaps.push(`${neverVerified} mijloace de stingere nu au nicio verificare înregistrată.`);
    if (!lastDrill) gaps.push("Nu este înregistrat niciun exercițiu de evacuare.");
    else if (drillsOverdue) gaps.push("Exercițiul de evacuare periodic este restant.");
    if (siteEmployees.length && trained < siteEmployees.length) {
      gaps.push(`${siteEmployees.length - trained} angajați nu au instruire PSI valabilă.`);
    }
    for (const role of missingRequired) gaps.push(`Nu este desemnat: ${ROLE_LABELS[role]}.`);

    const docScore =
      (documents.evacuationPlan ? 10 : 0) + (documents.instructions ? 8 : 0) + (documents.intervention ? 7 : 0);
    const equipmentScore = siteEquipment.length ? ((ok + dueSoon) / siteEquipment.length) * 25 : 0;
    const drillScore = drillsOverdue ? 0 : 20;
    const personnelScore = (coveragePercent / 100) * 20;
    const responsibleScore = ((REQUIRED_ROLES.length - missingRequired.length) / REQUIRED_ROLES.length) * 10;
    const score = Math.round(docScore + equipmentScore + drillScore + personnelScore + responsibleScore);
    const traffic: Traffic =
      score < 60 || !documents.evacuationPlan ? "RED" : score < 85 || overdue > 0 ? "YELLOW" : "GREEN";

    return {
      docs,
      personnelRows,
      overdueEquipment,
      readiness: {
        worksiteId: site.id,
        worksiteCode: site.code,
        worksiteName: site.name,
        legalEntityName: site.legalEntity?.name ?? null,
        score,
        traffic,
        documents,
        equipment: { total: siteEquipment.length, ok, dueSoon, overdue, neverVerified, byCategory },
        drills: {
          lastConductedAt: lastDrill?.conductedAt.toISOString() ?? null,
          nextDueAt: drillNextDue?.toISOString() ?? null,
          overdue: drillsOverdue,
          countLast12Months: siteDrills.filter((row) => row.conductedAt >= yearAgo).length
        },
        personnel: {
          activeEmployees: siteEmployees.length,
          trained,
          coveragePercent,
          untrained: personnelRows
            .filter((row) => !row.trained)
            .map((row) => ({ employeeId: row.employeeId, fullName: row.fullName }))
        },
        responsibles: { roles, missingRequired },
        gaps
      }
    };
  }
}
