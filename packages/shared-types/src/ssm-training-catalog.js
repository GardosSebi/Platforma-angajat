export const SSM_TRAINING_CATEGORY_META = [
    {
        category: "INTRODUCTORY_GENERAL",
        labelRo: "Introductiv-generală",
        whenPerformed: "La angajare (și detașați, delegați, personal temporar)",
        legalMinDuration: "Minim 8 ore",
        defaultLegalHours: 8,
        defaultReminderDays: [30, 15, 7]
    },
    {
        category: "WORKPLACE",
        labelRo: "La locul de muncă",
        whenPerformed: "Înainte de admiterea efectivă la lucru",
        legalMinDuration: "Conform tematică post",
        defaultReminderDays: [30, 15, 7]
    },
    {
        category: "PERIODIC",
        labelRo: "Periodică",
        whenPerformed: "La intervale max. 6 luni (stabilit prin instrucțiuni proprii)",
        legalMinDuration: "Conform tematică",
        defaultRecurrenceDays: 180,
        defaultReminderDays: [30, 15, 7]
    },
    {
        category: "SUPPLEMENTARY",
        labelRo: "Suplimentară",
        whenPerformed: "Absență >30 zile, accident, echipament nou, modificare proceduri, reluare activitate",
        legalMinDuration: "Minim 8 ore",
        defaultLegalHours: 8,
        defaultReminderDays: [30, 15, 7]
    },
    {
        category: "EMERGENCY_PSI",
        labelRo: "PSI / Situații de urgență",
        whenPerformed: "La angajare și periodic; simulare evacuare",
        legalMinDuration: "Conform plan PSI",
        defaultRecurrenceDays: 180,
        defaultReminderDays: [30, 15, 7]
    }
];
export function trainingCategoryLabel(category) {
    return SSM_TRAINING_CATEGORY_META.find((m) => m.category === category)?.labelRo ?? category;
}
export function trainingCategoryMeta(category) {
    return SSM_TRAINING_CATEGORY_META.find((m) => m.category === category);
}
