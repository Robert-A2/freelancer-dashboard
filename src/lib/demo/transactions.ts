// Demo transaction generator
// Produces a realistic 36-month transaction history for Sophie Martin,
// Freelance UX Designer, Paris — Jan 2023 to Dec 2025.

export interface DemoTransaction {
  id: string;
  transactionDate: Date;
  description: string;
  amount: number; // always positive (type determines direction)
  transactionType: "income" | "expense" | "savings" | "transfer";
  category: string;
  intent: string | null;
  intentConfidence: "high" | "medium" | "low";
  needsReview: boolean;
}

// ── Income plan ───────────────────────────────────────────────────────────────
// Monthly income by source. nexo = Nexo Startup (main), nova = Nova Digital,
// dc = DesignCraft Agency (occasional projects).
// August is always light (vacation).

const INCOME_PLAN: Record<string, { nexo: number; nova: number; dc: number }> = {
  "2023-01": { nexo: 2200, nova: 0,    dc: 0    },
  "2023-02": { nexo: 2200, nova: 0,    dc: 0    },
  "2023-03": { nexo: 2400, nova: 0,    dc: 0    },
  "2023-04": { nexo: 2400, nova: 0,    dc: 0    },
  "2023-05": { nexo: 2600, nova: 0,    dc: 2400 },
  "2023-06": { nexo: 2600, nova: 1100, dc: 0    },
  "2023-07": { nexo: 2600, nova: 1100, dc: 0    },
  "2023-08": { nexo: 2000, nova: 800,  dc: 0    },
  "2023-09": { nexo: 2600, nova: 1100, dc: 0    },
  "2023-10": { nexo: 2600, nova: 1100, dc: 0    },
  "2023-11": { nexo: 2800, nova: 1100, dc: 2400 },
  "2023-12": { nexo: 2800, nova: 1100, dc: 0    },
  "2024-01": { nexo: 2800, nova: 1200, dc: 0    },
  "2024-02": { nexo: 2800, nova: 1200, dc: 0    },
  "2024-03": { nexo: 3000, nova: 1200, dc: 0    },
  "2024-04": { nexo: 3000, nova: 1400, dc: 0    },
  "2024-05": { nexo: 3000, nova: 1400, dc: 0    },
  "2024-06": { nexo: 3000, nova: 1400, dc: 2500 },
  "2024-07": { nexo: 3000, nova: 1400, dc: 0    },
  "2024-08": { nexo: 2400, nova: 1000, dc: 0    },
  "2024-09": { nexo: 3000, nova: 1400, dc: 0    },
  "2024-10": { nexo: 3000, nova: 1400, dc: 0    },
  "2024-11": { nexo: 3000, nova: 1400, dc: 0    },
  "2024-12": { nexo: 3000, nova: 1200, dc: 0    },
  "2025-01": { nexo: 3200, nova: 1400, dc: 0    },
  "2025-02": { nexo: 3200, nova: 1400, dc: 0    },
  "2025-03": { nexo: 3200, nova: 1400, dc: 0    },
  "2025-04": { nexo: 3400, nova: 1400, dc: 0    },
  "2025-05": { nexo: 3400, nova: 1400, dc: 0    },
  "2025-06": { nexo: 3400, nova: 800,  dc: 0    },
  "2025-07": { nexo: 3400, nova: 0,    dc: 0    },
  "2025-08": { nexo: 2800, nova: 0,    dc: 0    },
  "2025-09": { nexo: 3400, nova: 0,    dc: 0    },
  "2025-10": { nexo: 3400, nova: 800,  dc: 0    }, // Nova's final payment
  "2025-11": { nexo: 3600, nova: 0,    dc: 0    },
  "2025-12": { nexo: 3600, nova: 0,    dc: 0    },
};

// ── Expense rules ─────────────────────────────────────────────────────────────

interface ExpenseRule {
  description: string;
  amount: number | ((year: number, month: number) => number | null);
  category: string;
  intent: string;
  day: number; // day of month for the transaction
  startYear?: number;
  startMonth?: number; // 1-12, default 1
}

const EXPENSE_RULES: ExpenseRule[] = [
  // Software subscriptions
  { description: "ADOBE SYSTEMS CREATIVE CLOUD",  amount: 54.99, category: "software", intent: "subscription", day: 2  },
  { description: "NOTION LABS",                   amount: 8.00,  category: "software", intent: "subscription", day: 3  },
  { description: "FIGMA INC",                     amount: 15.00, category: "software", intent: "subscription", day: 5,  startYear: 2023, startMonth: 3  },
  { description: "OPENAI CHATGPT PLUS",           amount: 20.00, category: "software", intent: "subscription", day: 7,  startYear: 2023, startMonth: 6  },
  // Telecom
  { description: "SFR MOBILE",                    amount: 25.00, category: "telecom",  intent: "personal_expense", day: 10 },
  // Coworking
  { description: "WEWORK COWORKING",              amount: (y, _m) => y === 2025 ? 220.00 : 200.00, category: "coworking", intent: "business_expense", day: 4, startYear: 2023, startMonth: 4 },
  // Transport — RATP monthly pass (price increases over the years)
  { description: "RATP NAVIGO MENSUEL",           amount: (y, _m) => y === 2023 ? 85.00 : y === 2024 ? 90.00 : 95.00, category: "transport", intent: "personal_expense", day: 1 },
];

// SNCF trips (irregular)
const SNCF_TRIPS: { year: number; month: number; amount: number; day: number }[] = [
  { year: 2023, month: 6,  amount: 45,  day: 14 },
  { year: 2023, month: 9,  amount: 38,  day: 22 },
  { year: 2024, month: 3,  amount: 58,  day: 8  },
  { year: 2024, month: 7,  amount: 62,  day: 17 },
  { year: 2024, month: 10, amount: 55,  day: 9  },
  { year: 2025, month: 2,  amount: 78,  day: 21 },
  { year: 2025, month: 5,  amount: 72,  day: 6  },
  { year: 2025, month: 8,  amount: 65,  day: 19 },
  { year: 2025, month: 11, amount: 88,  day: 12 },
];

// Accountant — quarterly
const ACCOUNTANT_QUARTERS: { month: number }[] = [
  { month: 3 }, { month: 6 }, { month: 9 }, { month: 12 },
];

// URSSAF — quarterly tax payments (approximate 22% of prior quarter revenue)
const URSSAF: { year: number; month: number; amount: number; day: number }[] = [
  { year: 2023, month: 3,  amount: 980,  day: 15 },
  { year: 2023, month: 6,  amount: 1050, day: 15 },
  { year: 2023, month: 9,  amount: 1120, day: 15 },
  { year: 2023, month: 12, amount: 1200, day: 15 },
  { year: 2024, month: 3,  amount: 1200, day: 15 },
  { year: 2024, month: 6,  amount: 1300, day: 15 },
  { year: 2024, month: 9,  amount: 1350, day: 15 },
  { year: 2024, month: 12, amount: 1280, day: 15 },
  { year: 2025, month: 3,  amount: 1350, day: 15 },
  { year: 2025, month: 6,  amount: 1400, day: 15 },
  { year: 2025, month: 9,  amount: 1250, day: 15 },
  { year: 2025, month: 12, amount: 1150, day: 15 },
];

// Savings transfers — monthly
const SAVINGS_PLAN: Record<string, number> = {
  "2023-01": 200, "2023-02": 200, "2023-03": 200, "2023-04": 250,
  "2023-05": 300, "2023-06": 300, "2023-07": 300, "2023-08": 150,
  "2023-09": 300, "2023-10": 300, "2023-11": 400, "2023-12": 350,
  "2024-01": 350, "2024-02": 350, "2024-03": 350, "2024-04": 400,
  "2024-05": 400, "2024-06": 450, "2024-07": 400, "2024-08": 200,
  "2024-09": 400, "2024-10": 400, "2024-11": 400, "2024-12": 400,
  "2025-01": 450, "2025-02": 450, "2025-03": 450, "2025-04": 500,
  "2025-05": 500, "2025-06": 400, "2025-07": 350, "2025-08": 150,
  "2025-09": 350, "2025-10": 350, "2025-11": 350, "2025-12": 350,
};

// ── Generator ─────────────────────────────────────────────────────────────────

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

let _idCounter = 1;
function nextId(): string {
  return `demo-${_idCounter++}`;
}

export function generateDemoTransactions(): DemoTransaction[] {
  _idCounter = 1;
  const txs: DemoTransaction[] = [];

  for (let year = 2023; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, "0")}`;

      // ── Income ──────────────────────────────────────────────────────────────
      const inc = INCOME_PLAN[key];
      if (inc) {
        if (inc.nexo > 0) {
          txs.push({
            id: nextId(),
            transactionDate: utcDate(year, month, 8),
            description: "NEXO STARTUP VIREMENT",
            amount: inc.nexo,
            transactionType: "income",
            category: "client payment",
            intent: "freelance_income",
            intentConfidence: "high",
            needsReview: false,
          });
        }
        if (inc.nova > 0) {
          txs.push({
            id: nextId(),
            transactionDate: utcDate(year, month, 15),
            description: "NOVA DIGITAL PAIEMENT",
            amount: inc.nova,
            transactionType: "income",
            category: "client payment",
            intent: "freelance_income",
            intentConfidence: "high",
            needsReview: false,
          });
        }
        if (inc.dc > 0) {
          txs.push({
            id: nextId(),
            transactionDate: utcDate(year, month, 20),
            description: "DESIGNCRAFT AGENCY FACTURE",
            amount: inc.dc,
            transactionType: "income",
            category: "client payment",
            intent: "freelance_income",
            intentConfidence: "high",
            needsReview: false,
          });
        }
      }

      // ── Recurring expenses ───────────────────────────────────────────────────
      for (const rule of EXPENSE_RULES) {
        const startYear  = rule.startYear  ?? 2023;
        const startMonth = rule.startMonth ?? 1;
        if (year < startYear || (year === startYear && month < startMonth)) continue;

        const amount = typeof rule.amount === "function"
          ? rule.amount(year, month)
          : rule.amount;
        if (amount === null) continue;

        txs.push({
          id: nextId(),
          transactionDate: utcDate(year, month, rule.day),
          description: rule.description,
          amount,
          transactionType: "expense",
          category: rule.category,
          intent: rule.intent,
          intentConfidence: "high",
          needsReview: false,
        });
      }

      // ── SNCF trips ────────────────────────────────────────────────────────────
      for (const trip of SNCF_TRIPS) {
        if (trip.year === year && trip.month === month) {
          txs.push({
            id: nextId(),
            transactionDate: utcDate(year, month, trip.day),
            description: "SNCF BILLET TGV",
            amount: trip.amount,
            transactionType: "expense",
            category: "transport",
            intent: "personal_expense",
            intentConfidence: "high",
            needsReview: false,
          });
        }
      }

      // ── Accountant (quarterly) ────────────────────────────────────────────────
      if (ACCOUNTANT_QUARTERS.some(q => q.month === month)) {
        txs.push({
          id: nextId(),
          transactionDate: utcDate(year, month, 25),
          description: "JULIEN LEGROS EXPERTISE COMPTABLE",
          amount: 150,
          transactionType: "expense",
          category: "professional services",
          intent: "business_expense",
          intentConfidence: "high",
          needsReview: false,
        });
      }

      // ── URSSAF tax payments ───────────────────────────────────────────────────
      for (const tax of URSSAF) {
        if (tax.year === year && tax.month === month) {
          txs.push({
            id: nextId(),
            transactionDate: utcDate(year, month, tax.day),
            description: "URSSAF COTISATIONS SOCIALES",
            amount: tax.amount,
            transactionType: "expense",
            category: "tax",
            intent: "tax_payment",
            intentConfidence: "high",
            needsReview: false,
          });
        }
      }

      // ── Savings transfers ─────────────────────────────────────────────────────
      const savings = SAVINGS_PLAN[key];
      if (savings) {
        txs.push({
          id: nextId(),
          transactionDate: utcDate(year, month, 27),
          description: "VIREMENT COMPTE EPARGNE",
          amount: savings,
          transactionType: "savings",
          category: "savings",
          intent: "savings_transfer",
          intentConfidence: "high",
          needsReview: false,
        });
      }
    }
  }

  return txs.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
}

// Singleton — generated once at module load
export const DEMO_TRANSACTIONS: DemoTransaction[] = generateDemoTransactions();

// Demo reference date — the day after the last transaction
export const DEMO_REF_DATE = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026

// Demo persona
export const DEMO_PERSONA = {
  name: "Sophie Martin",
  firstName: "Sophie",
  role: "Freelance UX Designer",
  location: "Paris",
};
