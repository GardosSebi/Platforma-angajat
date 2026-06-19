export const SURVEY_QUESTION_TYPES = [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "SCALE",
    "TEXT",
    "LONG_TEXT",
    "DATE",
    "BOOLEAN",
    "NUMBER",
    "RATING_NPS"
];
export const SURVEY_QUESTION_TYPE_LABELS = {
    SINGLE_CHOICE: "Alegere unică",
    MULTIPLE_CHOICE: "Alegere multiplă",
    SCALE: "Scală",
    TEXT: "Text scurt",
    LONG_TEXT: "Text lung",
    DATE: "Dată",
    BOOLEAN: "Da / Nu",
    NUMBER: "Număr",
    RATING_NPS: "Scor NPS (0–10)"
};
export function surveyQuestionNeedsOptions(type) {
    return type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
}
export const SURVEY_TYPES = ["ENGAGEMENT", "COMPLIANCE", "FEEDBACK", "EXIT", "PULSE", "CUSTOM"];
export const SURVEY_TYPE_LABELS = {
    ENGAGEMENT: "Angajare / satisfacție",
    COMPLIANCE: "Conformitate SSM",
    FEEDBACK: "Feedback",
    EXIT: "Părăsire companie",
    PULSE: "Pulse check",
    CUSTOM: "Personalizat"
};
export const SURVEY_AUDIENCE_TYPES = ["ALL", "WORKSITE", "DEPARTMENT", "JOB_POSITION", "EMPLOYEE_GROUP", "EMPLOYEE", "CUSTOM"];
