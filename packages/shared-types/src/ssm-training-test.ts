import type { SsmTrainingCategory } from "./ssm";

export const SSM_TRAINING_PASS_THRESHOLD_PERCENT = 80;

export interface SsmTrainingTestQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface SsmTrainingTestQuestionPublic {
  id: string;
  text: string;
  options: string[];
}

export interface SsmTrainingTestAttemptMeta {
  questionIds: string[];
  permutations: Record<string, number[]>;
}

export interface SsmTrainingTestGradeResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
}

export interface StartSsmTrainingTestResponse {
  attemptId: string;
  questions: SsmTrainingTestQuestionPublic[];
  passThresholdPercent: number;
}

const COMMON_QUESTIONS: SsmTrainingTestQuestion[] = [
  {
    id: "SSM-COM-001",
    text: "Care este scopul principal al instruirii SSM?",
    options: [
      "Creșterea productivității indiferent de riscuri",
      "Prevenirea accidentelor și a bolilor profesionale",
      "Reducerea costurilor cu materialele",
      "Organizarea pauzelor de masă"
    ],
    correctIndex: 1
  },
  {
    id: "SSM-COM-002",
    text: "Ce trebuie să faci imediat când observi o situație periculoasă la locul de muncă?",
    options: [
      "Ignori situația dacă nu te privește direct",
      "Anunți responsabilul SSM / superiorul ierarhic și iei măsuri imediate de protecție",
      "Aștepți următoarea instruire periodică",
      "Postezi pe rețelele sociale"
    ],
    correctIndex: 1
  },
  {
    id: "SSM-COM-003",
    text: "Echipamentele individuale de protecție (EIP) trebuie utilizate:",
    options: [
      "Doar când vine control ITM",
      "Conform instrucțiunilor și normativului pentru activitatea desfășurată",
      "Doar iarna",
      "Doar de către personal nou"
    ],
    correctIndex: 1
  },
  {
    id: "SSM-COM-004",
    text: "Semnarea fișei de instruire confirmă că angajatul:",
    options: [
      "A citit doar titlul materialului",
      "A parcurs materialul, a înțeles conținutul și a trecut testul",
      "Este de acord cu salariul",
      "Nu mai poate refuza munca suplimentară"
    ],
    correctIndex: 1
  },
  {
    id: "SSM-COM-005",
    text: "Accidentul de muncă trebuie comunicat responsabilului SSM:",
    options: ["În maximum 30 de zile", "Imediat / cât mai curând posibil", "Doar dacă există zile de concediu medical", "Niciodată"],
    correctIndex: 1
  }
];

const CATEGORY_QUESTIONS: Partial<Record<SsmTrainingCategory, SsmTrainingTestQuestion[]>> = {
  INTRODUCTORY_GENERAL: [
    {
      id: "SSM-INT-001",
      text: "Instruirea introductiv-generală se efectuează:",
      options: ["La 5 ani", "La angajare", "Doar pentru manageri", "Doar după primul accident"],
      correctIndex: 1
    },
    {
      id: "SSM-INT-002",
      text: "Durata minimă legală a instruirii introductiv-generale este, de regulă:",
      options: ["2 ore", "8 ore", "30 minute", "1 oră"],
      correctIndex: 1
    }
  ],
  WORKPLACE: [
    {
      id: "SSM-LM-001",
      text: "Instruirea la locul de muncă se face:",
      options: [
        "După admiterea la lucru, fără verificări",
        "Înainte de admiterea efectivă la postul de lucru",
        "Doar la final de an",
        "Doar pentru contractori externi"
      ],
      correctIndex: 1
    },
    {
      id: "SSM-LM-002",
      text: "Instruirea la locul de muncă trebuie adaptată:",
      options: [
        "Doar la cererea angajatului",
        "Riscurilor specifice postului și locului de muncă",
        "Exclusiv procedurilor contabile",
        "Standardului general, identic pentru toate posturile"
      ],
      correctIndex: 1
    }
  ],
  PERIODIC: [
    {
      id: "SSM-PER-001",
      text: "Instruirea periodică are rolul de a:",
      options: [
        "Înlocui complet instruirea introductivă",
        "Actualiza cunoștințele SSM la intervale stabilite",
        "Elimina necesitatea EIP",
        "Reduce numărul de controale medicale"
      ],
      correctIndex: 1
    },
    {
      id: "SSM-PER-002",
      text: "Frecvența instruirii periodice este stabilită:",
      options: [
        "De fiecare angajat individual",
        "Prin instrucțiuni proprii SSM, respectând cerințele legale",
        "Doar de ITM, fără implicarea angajatorului",
        "La 10 ani fix"
      ],
      correctIndex: 1
    }
  ],
  SUPPLEMENTARY: [
    {
      id: "SSM-SUP-001",
      text: "Instruirea suplimentară se aplică, printre altele, când:",
      options: [
        "Angajatul solicită concediu",
        "Intervin modificări de proceduri, echipamente noi sau reluarea activității după absență îndelungată",
        "Se schimbă logo-ul companiei",
        "Se organizează team building"
      ],
      correctIndex: 1
    },
    {
      id: "SSM-SUP-002",
      text: "Durata minimă legală a instruirii suplimentare este, de regulă:",
      options: ["1 oră", "8 ore", "15 minute", "4 zile"],
      correctIndex: 1
    }
  ],
  EMERGENCY_PSI: [
    {
      id: "SSM-PSI-001",
      text: "La auzirea alarmei de incendiu, prima acțiune este:",
      options: [
        "Colectarea bunurilor personale",
        "Oprirea utilajelor periculoase (dacă e cazul) și evacuarea calmă pe traseul stabilit",
        "Așteptarea în birou până la confirmarea managerului",
        "Utilizarea liftului rapid"
      ],
      correctIndex: 1
    },
    {
      id: "SSM-PSI-002",
      text: "Stingătoarele de incendiu trebuie:",
      options: [
        "Folosite ca suport pentru uși",
        "Verificate periodic și accesibile",
        "Păstrate doar în arhivă",
        "Deschise pentru ventilare"
      ],
      correctIndex: 1
    }
  ]
};

export function resolveTrainingTestQuestions(category: SsmTrainingCategory): SsmTrainingTestQuestion[] {
  const specific = CATEGORY_QUESTIONS[category] ?? [];
  return [...COMMON_QUESTIONS, ...specific];
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTrainingTestPresentation(questions: SsmTrainingTestQuestion[]): {
  meta: SsmTrainingTestAttemptMeta;
  questions: SsmTrainingTestQuestionPublic[];
} {
  const questionIds = questions.map((q) => q.id);
  const permutations: Record<string, number[]> = {};
  const publicQuestions: SsmTrainingTestQuestionPublic[] = questions.map((question) => {
    const order = shuffleArray(question.options.map((_, index) => index));
    permutations[question.id] = order;
    return {
      id: question.id,
      text: question.text,
      options: order.map((index) => question.options[index]!)
    };
  });

  return {
    meta: { questionIds, permutations },
    questions: publicQuestions
  };
}

export function gradeTrainingTestAnswers(
  meta: SsmTrainingTestAttemptMeta,
  answers: Record<string, number>,
  bank: SsmTrainingTestQuestion[]
): SsmTrainingTestGradeResult {
  const byId = new Map(bank.map((q) => [q.id, q]));
  let correctCount = 0;
  const totalCount = meta.questionIds.length;

  for (const questionId of meta.questionIds) {
    const question = byId.get(questionId);
    const permutation = meta.permutations[questionId];
    const selectedDisplayIndex = answers[questionId];
    if (!question || !permutation || selectedDisplayIndex == null) {
      continue;
    }
    const selectedOriginalIndex = permutation[selectedDisplayIndex];
    if (selectedOriginalIndex === question.correctIndex) {
      correctCount += 1;
    }
  }

  const score = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
  return {
    score,
    passed: score >= SSM_TRAINING_PASS_THRESHOLD_PERCENT,
    correctCount,
    totalCount
  };
}
