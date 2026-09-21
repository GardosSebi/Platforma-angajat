import type {
  CreateSurveyRequest,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionType
} from "@repo/shared-types/surveys";
import {
  SURVEY_QUESTION_TYPE_LABELS,
  surveyQuestionNeedsOptions,
  surveyQuestionNeedsRange
} from "@repo/shared-types/surveys";

export type SurveyFormState = Omit<
  CreateSurveyRequest,
  "questionSchema" | "conditionalLogic" | "targetEmployeeIds" | "translations"
> & {
  targetEmployeeIdsCsv: string;
  opensAtInput: string;
  closesAtInput: string;
  responseLimitInput: string;
  translationRoTitle: string;
  translationEnTitle: string;
};

export type QuestionFormState = {
  id: string;
  type: SurveyQuestionType;
  title: string;
  titleEn: string;
  required: boolean;
  options: SurveyQuestionOption[];
  min: number;
  max: number;
  multiTextCount: number;
};

export const PALETTE_GROUPS: Array<{
  title: string;
  types: SurveyQuestionType[];
}> = [
  {
    title: "Alegere",
    types: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "DROPDOWN", "MULTI_DROPDOWN", "IMAGE_SELECT"]
  },
  {
    title: "Evaluare",
    types: ["BOOLEAN", "SCALE", "RATING_NPS", "RANKING"]
  },
  {
    title: "Text și date",
    types: ["TEXT", "LONG_TEXT", "MULTI_TEXT", "NUMBER", "DATE"]
  },
  {
    title: "Fișiere",
    types: ["FILE_UPLOAD"]
  }
];

const DEFAULT_OPTIONS = [
  { value: "Opțiunea 1", label: "Opțiunea 1" },
  { value: "Opțiunea 2", label: "Opțiunea 2" },
  { value: "Opțiunea 3", label: "Opțiunea 3" }
];

export function rangeDefaults(type: SurveyQuestionType): { min: number; max: number } {
  if (type === "RATING_NPS") return { min: 0, max: 10 };
  return { min: 1, max: 5 };
}

export function createSurveyQuestion(type: SurveyQuestionType, id: string): SurveyQuestion {
  const question: SurveyQuestion = {
    id,
    type,
    title: SURVEY_QUESTION_TYPE_LABELS[type],
    required: true
  };
  if (surveyQuestionNeedsOptions(type)) {
    question.options = DEFAULT_OPTIONS.map((option) => ({ ...option }));
  }
  if (surveyQuestionNeedsRange(type)) {
    const range = rangeDefaults(type);
    question.min = range.min;
    question.max = range.max;
  }
  if (type === "MULTI_TEXT") {
    question.multiTextCount = 3;
  }
  return question;
}

export function questionToForm(question: SurveyQuestion, titleEn: string): QuestionFormState {
  const defaults = rangeDefaults(question.type);
  return {
    id: question.id,
    type: question.type,
    title: question.title,
    titleEn,
    required: question.required ?? false,
    options: question.options?.length ? question.options.map((option) => ({ ...option })) : DEFAULT_OPTIONS.map((option) => ({ ...option })),
    min: question.min ?? defaults.min,
    max: question.max ?? defaults.max,
    multiTextCount: question.multiTextCount ?? 3
  };
}

export function formToQuestion(form: QuestionFormState): SurveyQuestion {
  return {
    id: form.id,
    title: form.title.trim() || SURVEY_QUESTION_TYPE_LABELS[form.type],
    type: form.type,
    required: form.required,
    options: surveyQuestionNeedsOptions(form.type)
      ? form.options
          .map((option) => {
            const label = option.label.trim();
            if (!label) return null;
            const imageUrl = option.imageUrl?.trim();
            return { value: label, label, ...(imageUrl ? { imageUrl } : {}) };
          })
          .filter((option): option is NonNullable<typeof option> => option !== null)
      : undefined,
    min: surveyQuestionNeedsRange(form.type) ? form.min : undefined,
    max: surveyQuestionNeedsRange(form.type) ? form.max : undefined,
    multiTextCount: form.type === "MULTI_TEXT" ? form.multiTextCount : undefined
  };
}

export function emptyQuestionForm(id: string): QuestionFormState {
  return questionToForm(createSurveyQuestion("SINGLE_CHOICE", id), "");
}
