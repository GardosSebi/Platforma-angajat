export const SURVEY_QUESTION_TYPES = [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "DROPDOWN",
    "MULTI_DROPDOWN",
    "SCALE",
    "TEXT",
    "LONG_TEXT",
    "MULTI_TEXT",
    "DATE",
    "BOOLEAN",
    "NUMBER",
    "RATING_NPS",
    "RANKING",
    "FILE_UPLOAD",
    "IMAGE_SELECT"
];
export const SURVEY_QUESTION_TYPE_LABELS = {
    SINGLE_CHOICE: "Alegere unică (radio)",
    MULTIPLE_CHOICE: "Alegere multiplă (checkbox)",
    DROPDOWN: "Dropdown",
    MULTI_DROPDOWN: "Dropdown multi-select",
    SCALE: "Scală",
    TEXT: "Text scurt",
    LONG_TEXT: "Text lung",
    MULTI_TEXT: "Casete text multiple",
    DATE: "Dată",
    BOOLEAN: "Da / Nu",
    NUMBER: "Număr",
    RATING_NPS: "Scor NPS (0–10)",
    RANKING: "Clasament",
    FILE_UPLOAD: "Încărcare fișier",
    IMAGE_SELECT: "Selector imagini"
};
export function surveyQuestionNeedsOptions(type) {
    return (type === "SINGLE_CHOICE" ||
        type === "MULTIPLE_CHOICE" ||
        type === "DROPDOWN" ||
        type === "MULTI_DROPDOWN" ||
        type === "RANKING" ||
        type === "IMAGE_SELECT");
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
