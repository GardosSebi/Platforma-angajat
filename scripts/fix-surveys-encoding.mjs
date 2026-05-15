import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "apps/web/src/features/surveys/pages/SurveysPage.tsx");

/** UTF-8 Romanian mis-decoded as Latin-1 / Windows-1252 in git history */
const MOJIBAKE_REPLACEMENTS = [
  ["È›", "ț"],
  ["Èš", "Ț"],
  ["È™", "ș"],
  ["È˜", "Ș"],
  ["Äƒ", "ă"],
  ["Ä‚", "Ă"],
  ["Ã®", "î"],
  ["ÃŽ", "Î"],
  ["Ã¢", "â"],
  ["Ã‚", "Â"],
  ["Â·", "·"],
  ["â€¦", "…"],
  ["\u2014", "—"],
  ["\u201e", "„"],
  ["â€\u009d", '"'],
  ["??", ""] // remove only after other fixes - skip this
];

function fixMojibake(text) {
  let out = text;
  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    if (bad === "??") continue;
    out = out.split(bad).join(good);
  }
  return out;
}

function applyFeaturePatches(s) {
  if (s.includes("openSurveyForRespond")) return s;

  s = s.replace(
    'import { FormEvent, useEffect, useMemo, useState } from "react";',
    `import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";`
  );

  s = s.replace(
    `  useSurveyStats,
  useSurveys,
  useSurveysOverview
} from "../hooks/useSurveys";`,
    `  useSurveyStats,
  useRespondedSurveyIds,
  useSurveys,
  useSurveysOverview
} from "../hooks/useSurveys";`
  );

  s = s.replace(
    "function questionNeedsOptions(type: SurveyQuestionType): boolean {",
    `function canOpenSurveyToComplete(roles: string[] | undefined): boolean {
  return hasPermission(roles, "surveys:respond") || hasPermission(roles, "surveys:edit");
}

function questionNeedsOptions(type: SurveyQuestionType): boolean {`
  );

  s = s.replace(
    "export function SurveysPage() {\n  const overviewQuery",
    `export function SurveysPage() {
  const navigate = useNavigate();
  const session = useAuthSession();
  const overviewQuery`
  );

  s = s.replace(
    "  const [downloadError, setDownloadError] = useState<string | null>(null);\n\n  const statsQuery",
    `  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [openingSurveyId, setOpeningSurveyId] = useState<string | null>(null);

  const statsQuery`
  );

  s = s.replace(
    "  const statsQuery = useSurveyStats(selectedSurveyId);\n  const kpi",
    `  const statsQuery = useSurveyStats(selectedSurveyId);
  const canComplete = canOpenSurveyToComplete(session?.roles);
  const respondedIdsQuery = useRespondedSurveyIds(canComplete);
  const respondedSurveyIds = respondedIdsQuery.data ?? new Set<string>();
  const kpi`
  );

  s = s.replace(
    "        setQuestionForm(EMPTY_QUESTION);\n      }\n    });\n  };\n\n  const generatePublicLink",
    `        setQuestionForm(EMPTY_QUESTION);
        setFormError(null);
      }
    });
  };

  const openSurveyForRespond = useCallback(
    async (surveyId: string) => {
      const survey = surveys.find((item) => item.id === surveyId);
      if (!survey) {
        setFormError("Selectați un sondaj din listă.");
        return;
      }
      if (respondedSurveyIds.has(surveyId)) {
        setFormError("Ați completat deja acest sondaj.");
        return;
      }
      if (survey.status === "CLOSED" || survey.status === "ARCHIVED") {
        setFormError("Sondajul este închis sau arhivat și nu mai poate fi completat.");
        return;
      }
      setFormError(null);
      setOpeningSurveyId(surveyId);
      try {
        if (survey.status === "DRAFT") {
          await activateSurvey.mutateAsync(surveyId);
        }
        navigate(\`/surveys/respond/\${surveyId}\`);
      } catch (error) {
        setFormError(mutationErrorMessage(error));
      } finally {
        setOpeningSurveyId(null);
      }
    },
    [surveys, respondedSurveyIds, activateSurvey, navigate]
  );

  const generatePublicLink`
  );

  if (!s.includes("createSurvey.isSuccess")) {
    s = s.replace(
      `{formError ? <motion.div className="feedback error">{formError}</div> : null}
            {createSurvey.isError`,
      `{formError ? <div className="feedback error">{formError}</div> : null}
            {createSurvey.isSuccess ? (
              <p className="feedback success" role="status">
                Sondaj salvat. Din lista din dreapta apasă <strong>Completează</strong> sau „Activează și completează”.
              </p>
            ) : null}
            {createSurvey.isError`
    );
    s = s.replace(
      `{formError ? <div className="feedback error">{formError}</div> : null}
            {createSurvey.isError`,
      `{formError ? <div className="feedback error">{formError}</div> : null}
            {createSurvey.isSuccess ? (
              <p className="feedback success" role="status">
                Sondaj salvat. Din lista din dreapta apasă <strong>Completează</strong> sau „Activează și completează”.
              </p>
            ) : null}
            {createSurvey.isError`
    );
  }

  const inlineOld = `<div className="ssm-inline-actions">
              <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => selectedSurveyId && activateSurvey.mutate(selectedSurveyId)}>
                Activează`;

  if (s.includes(inlineOld) && !s.includes("openSurveyForRespond(selectedSurvey.id)")) {
    s = s.replace(
      inlineOld,
      `<div className="ssm-inline-actions">
              {canComplete && selectedSurvey && respondedSurveyIds.has(selectedSurvey.id) ? (
                <span className="ssm-chip good" role="status">
                  Ați completat deja acest sondaj
                </span>
              ) : null}
              {canComplete && (!selectedSurvey || !respondedSurveyIds.has(selectedSurvey.id)) ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selectedSurvey || openingSurveyId !== null}
                  onClick={() => selectedSurvey && void openSurveyForRespond(selectedSurvey.id)}
                >
                  {openingSurveyId === selectedSurvey?.id
                    ? "Se pregătește…"
                    : selectedSurvey?.status === "DRAFT"
                      ? "Activează și completează"
                      : "Deschide și completează"}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" disabled={!selectedSurveyId} onClick={() => selectedSurveyId && activateSurvey.mutate(selectedSurveyId)}>
                Activează`
    );
  }

  const badgeOld = `                  <div className="ssm-badge-row">
                    <span className={\`ssm-chip \${survey.status === "ACTIVE" ? "good" : "warn"}\`}>{AUDIENCE_LABELS[survey.audienceType]}</span>
                  </div>
                </button>`;

  if (s.includes(badgeOld) && !s.includes("survey-list-complete-btn")) {
    s = s.replace(
      badgeOld,
      `                  <div className="ssm-badge-row">
                    <span className={\`ssm-chip \${survey.status === "ACTIVE" ? "good" : "warn"}\`}>{AUDIENCE_LABELS[survey.audienceType]}</span>
                    {canComplete && !respondedSurveyIds.has(survey.id) ? (
                      <button
                        type="button"
                        className="ssm-chip survey-list-complete-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openSurveyForRespond(survey.id);
                        }}
                      >
                        Completează
                      </button>
                    ) : null}
                    {canComplete && respondedSurveyIds.has(survey.id) ? (
                      <span className="ssm-chip good">Completat</span>
                    ) : null}
                  </div>
                </button>`
    );
  }

  return s;
}

let s = readFileSync(target, "utf8");
if (!s.includes("openSurveyForRespond")) {
  s = execSync("git show HEAD:apps/web/src/features/surveys/pages/SurveysPage.tsx", {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  s = applyFeaturePatches(s);
}

s = fixMojibake(s);
s = s.replace("</motion.div>", "</div>");
s = s.replace("<motion.div ", "<div ");
s = s.replace("unic??", "unică");
s = s.replace("multipl??", "multiplă");
s = s.replace("Scal??", "Scală");
s = s.replace("Dat??", "Dată");
s = s.replace("Ciorn??", "Ciornă");
s = s.replace("??nchis", "Închis");
s = s.replace("To??i", "Toți");
s = s.replace("angaja??ii", "angajații");
s = s.replace("angaja??i", "angajați");
s = s.replace("List??", "Listă");
s = s.replace("personalizat??", "personalizată");
s = s.replace("satisfac??ie", "satisfacție");
s = s.replace("experien??a", "experiența");
s = s.replace("?n platform", "în platform");
s = s.replace("Necesit??", "Necesită");
s = s.replace("?mbun??t????iri", "îmbunătățiri");
s = s.replace("ap??rut", "apărut");
s = s.replace("nea??teptat??", "neașteptată");
s = s.replace("Completeaz??", "Completează");
s = s.replace("?ntreb", "întreb");
s = s.replace("??i", "și");
s = s.replace("dac??", "dacă");
s = s.replace("op??iunile", "opțiunile");
s = s.replace("pu??in", "puțin");
s = s.replace("?ntreb??ri", "întrebări");
s = s.replace("pa??ii", "pașii");
s = s.replace("salveaz??", "salvează");
s = s.replace("prime??te", "primește");
s = s.replace("??ntreb??ri", "Întrebări");
s = s.replace("??ntrebare", "Întrebare");
s = s.replace("adaug??", "adaugă");
s = s.replace("Adaug??", "Adaugă");
s = s.replace("completat??", "completată");
s = s.replace("ad??uga", "adăuga");
s = s.replace("Po??i", "Poți");
s = s.replace("preg??tite", "pregătite");
s = s.replace("r??spunsuri", "răspunsuri");
s = s.replace("Activeaz??", "Activează");
s = s.replace("?nchide", "închide");
s = s.replace("Selecteaz??", "Selectează");
s = s.replace("exist??", "există");
s = s.replace("?nc??", "încă");
s = s.replace("Distribuire ??i", "Distribuire și");
s = s.replace("limit??", "limită");
s = s.replace("Creeaz??", "Creează");
s = s.replace("selecteaz??", "selectează");
s = s.replace("preg??te??te???", "pregătește…");
s = s.replace("colectare r??spunsuri ??i", "colectare răspunsuri și");
s = s.replace("Agreg??ri", "Agregări");
s = s.replace("Op??iunea", "Opțiunea");
s = s.replace("È˜terge", "Șterge");
s = s.replace("cÃ¢te", "câte");
s = s.replace("salveazÄƒ", "salvează");
s = s.replace(" A\\u021bi ", " Ați ");

writeFileSync(target, s, "utf8");

const sample = s.slice(s.indexOf("QUESTION_TYPE_LABELS"), s.indexOf("QUESTION_TYPE_LABELS") + 200);
console.log(
  JSON.stringify({
    ok: s.includes("Alegere unică") && s.includes("întrebări") && !s.includes("unic??"),
    hasOpen: s.includes("openSurveyForRespond"),
    sample
  })
);

try {
  unlinkSync(join(root, "apps/web/src/features/surveys/pages/SurveysPage.base.tsx"));
} catch {
  /* ignore */
}
