import { createServerFn } from "@tanstack/react-start";

/* ========================================================================
   Retirement Planning — server logic ("backend")
   Runs as TanStack server functions. Equivalent to:
     POST /api/retirement/calculate
     POST /api/chat
     GET  /api/health
   ======================================================================== */

export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedAnnualReturn: number; // percent, e.g. 7
  monthlyRetirementExpenses: number;
};

export type ProjectionPoint = {
  age: number;
  year: number;
  contributions: number;
  balance: number;
  target: number;
};

export type RetirementResult = {
  yearsLeft: number;
  projectedCorpus: number;
  targetCorpus: number;
  savingsGap: number;
  monthlyIncomeEstimate: number;
  suggestedMonthlyContribution: number;
  riskLevel: "Aggressive" | "Balanced" | "Conservative";
  onTrack: boolean;
  series: ProjectionPoint[];
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validate(input: RetirementInput): string | null {
  const keys: (keyof RetirementInput)[] = [
    "currentAge",
    "retirementAge",
    "currentSavings",
    "monthlyContribution",
    "expectedAnnualReturn",
    "monthlyRetirementExpenses",
  ];
  for (const k of keys) {
    if (!isFiniteNumber(input[k])) return `Invalid value for ${k}`;
    if (input[k] < 0) return `${k} cannot be negative`;
  }
  if (input.currentAge < 16 || input.currentAge > 100)
    return "Current age must be 16–100";
  if (input.retirementAge <= input.currentAge)
    return "Retirement age must be greater than current age";
  if (input.retirementAge > 100) return "Retirement age must be ≤ 100";
  if (input.expectedAnnualReturn > 30) return "Expected return seems too high";
  return null;
}

/** Future value of a lump sum + monthly contributions (compound, monthly). */
function computeProjection(input: RetirementInput): RetirementResult {
  const years = input.retirementAge - input.currentAge;
  const months = years * 12;
  const monthlyRate = input.expectedAnnualReturn / 100 / 12;

  // FV of current savings
  const fvLump =
    monthlyRate === 0
      ? input.currentSavings
      : input.currentSavings * Math.pow(1 + monthlyRate, months);

  // FV of recurring monthly contributions (annuity due — end of month)
  const fvAnnuity =
    monthlyRate === 0
      ? input.monthlyContribution * months
      : input.monthlyContribution *
        ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

  const projectedCorpus = fvLump + fvAnnuity;

  // Target corpus from 4% safe-withdrawal rule
  const annualExpenses = input.monthlyRetirementExpenses * 12;
  const targetCorpus = annualExpenses * 25;

  const savingsGap = Math.max(0, targetCorpus - projectedCorpus);

  // Suggested monthly contribution to bridge the gap
  let suggestedMonthlyContribution = input.monthlyContribution;
  if (savingsGap > 0 && months > 0) {
    const additionalNeeded = savingsGap;
    const additionalMonthly =
      monthlyRate === 0
        ? additionalNeeded / months
        : additionalNeeded /
          ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    suggestedMonthlyContribution =
      input.monthlyContribution + Math.max(0, additionalMonthly);
  }

  // Risk level — broadly: younger = aggressive
  let riskLevel: RetirementResult["riskLevel"] = "Balanced";
  if (years >= 25) riskLevel = "Aggressive";
  else if (years <= 10) riskLevel = "Conservative";

  // Sanitize NaN / Infinity
  const clean = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);

  return {
    yearsLeft: years,
    projectedCorpus: clean(projectedCorpus),
    targetCorpus: clean(targetCorpus),
    savingsGap: clean(savingsGap),
    monthlyIncomeEstimate: clean((projectedCorpus * 0.04) / 12),
    suggestedMonthlyContribution: clean(suggestedMonthlyContribution),
    riskLevel,
    onTrack: projectedCorpus >= targetCorpus,
  };
}

export const calculateRetirement = createServerFn({ method: "POST" })
  .inputValidator((input: RetirementInput) => input)
  .handler(async ({ data }) => {
    const err = validate(data);
    if (err) throw new Error(err);
    return computeProjection(data);
  });

/* ----------------------- Chatbot ----------------------- */

export type ChatMessageInput = {
  message: string;
  context?: Partial<RetirementResult & RetirementInput>;
};

function generateAdvice({ message, context }: ChatMessageInput): string {
  const m = message.toLowerCase().trim();
  const ctx = context ?? {};

  // Greetings
  if (/^(hi|hello|hey|yo|namaste)\b/.test(m)) {
    return "Hi! I'm your retirement co-pilot. Ask me about compound interest, the 4% rule, asset allocation, or how to close your savings gap.";
  }

  if (/4%|withdrawal|safe withdrawal/.test(m)) {
    return "The **4% rule** suggests you can withdraw 4% of your portfolio in year one of retirement, then adjust for inflation each year — historically lasting ~30 years. That's why your target corpus is roughly 25× your annual expenses.";
  }

  if (/compound|interest|growth/.test(m)) {
    return "Compound interest is the engine of retirement. Each month, returns earn returns on themselves. Starting 10 years earlier can easily **double** your final corpus — time matters more than amount.";
  }

  if (/risk|allocation|stocks|bonds|equity/.test(m)) {
    const lvl = ctx.riskLevel ?? "Balanced";
    if (lvl === "Aggressive")
      return "With 25+ years until retirement, an **aggressive** allocation (~80–90% equities) is usually appropriate. Volatility is your friend when you're buying every month.";
    if (lvl === "Conservative")
      return "With under 10 years left, shift toward **capital preservation**: ~40–60% equities, the rest in high-quality bonds and short-duration instruments.";
    return "A **balanced** mix (~60–70% equities, the rest in bonds) suits a 10–25 year horizon. Rebalance once a year.";
  }

  if (/gap|short|behind|catch.?up/.test(m)) {
    if (ctx.savingsGap && ctx.savingsGap > 0 && ctx.suggestedMonthlyContribution) {
      return `You're projected to fall short by **$${ctx.savingsGap.toLocaleString()}**. To close the gap, increase your monthly contribution to about **$${ctx.suggestedMonthlyContribution.toLocaleString()}**, or consider working a few extra years.`;
    }
    return "Three levers close a savings gap: (1) save more each month, (2) work longer, (3) reduce planned expenses. Even small monthly increases compound dramatically.";
  }

  if (/inflation/.test(m)) {
    return "Assume **2–3% inflation** long-term. Your monthly expense input should reflect *today's* dollars — the 4% rule already bakes in inflation-adjusted withdrawals.";
  }

  if (/tax|401k|ira|roth/.test(m)) {
    return "Maximize tax-advantaged accounts first: employer match → Roth IRA → max 401(k). A Roth is especially powerful when you're in a low tax bracket today.";
  }

  if (/emergency|fund/.test(m)) {
    return "Keep **3–6 months of expenses** in a high-yield savings account *before* aggressive investing. It prevents you from selling investments at the worst time.";
  }

  if (/start|begin|how/.test(m)) {
    return "Start with three numbers: your monthly expenses, your current savings, and your target retirement age. Fill the planner on the left — I'll calculate your trajectory instantly.";
  }

  if (ctx.onTrack === true) {
    return "Good news — you're projected to be **on track**. Stay consistent, rebalance annually, and revisit this plan every 12 months.";
  }
  if (ctx.onTrack === false) {
    return `You're currently off-track. Try increasing your monthly contribution to ~$${(ctx.suggestedMonthlyContribution ?? 0).toLocaleString()} or extending your retirement age by 2–3 years.`;
  }

  return "I can help with the 4% rule, compound interest, asset allocation, closing your savings gap, taxes, and inflation. What would you like to dig into?";
}

export const chatRespond = createServerFn({ method: "POST" })
  .inputValidator((input: ChatMessageInput) => {
    if (!input || typeof input.message !== "string")
      throw new Error("Message is required");
    if (input.message.trim().length === 0) throw new Error("Message is empty");
    if (input.message.length > 1000) throw new Error("Message too long");
    return input;
  })
  .handler(async ({ data }) => {
    // Simulate small thinking latency for nicer UX
    await new Promise((r) => setTimeout(r, 350));
    return { reply: generateAdvice(data), at: new Date().toISOString() };
  });

export const healthCheck = createServerFn({ method: "GET" }).handler(
  async () => ({
    status: "ok",
    service: "retirement-advisory",
    time: new Date().toISOString(),
  })
);
