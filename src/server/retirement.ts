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

  // Year-by-year projection series for charting
  const currentYear = new Date().getFullYear();
  const series: ProjectionPoint[] = [];
  let balance = input.currentSavings;
  let totalContributions = input.currentSavings;
  series.push({
    age: input.currentAge,
    year: currentYear,
    contributions: clean(totalContributions),
    balance: clean(balance),
    target: clean(targetCorpus),
  });
  for (let y = 1; y <= years; y++) {
    for (let mo = 0; mo < 12; mo++) {
      balance = balance * (1 + monthlyRate) + input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }
    series.push({
      age: input.currentAge + y,
      year: currentYear + y,
      contributions: clean(totalContributions),
      balance: clean(balance),
      target: clean(targetCorpus),
    });
  }

  return {
    yearsLeft: years,
    projectedCorpus: clean(projectedCorpus),
    targetCorpus: clean(targetCorpus),
    savingsGap: clean(savingsGap),
    monthlyIncomeEstimate: clean((projectedCorpus * 0.04) / 12),
    suggestedMonthlyContribution: clean(suggestedMonthlyContribution),
    riskLevel,
    onTrack: projectedCorpus >= targetCorpus,
    series,
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

// Whitelist of retirement-related keywords. Anything outside this scope is rejected.
const RETIREMENT_KEYWORDS = [
  "retire", "retirement", "pension", "401k", "401(k)", "ira", "roth",
  "compound", "interest", "growth", "withdraw", "withdrawal", "4%",
  "safe withdrawal", "corpus", "savings", "save", "saving", "nest egg",
  "allocation", "asset", "stocks", "stock", "bonds", "bond", "equity",
  "equities", "etf", "mutual fund", "index fund", "portfolio", "rebalance",
  "risk", "aggressive", "conservative", "balanced", "diversif",
  "inflation", "tax", "taxes", "annuity", "social security", "medicare",
  "gap", "shortfall", "behind", "catch up", "catchup", "contribution",
  "contribute", "monthly", "yearly", "annual", "return", "returns",
  "expenses", "expense", "budget", "income", "fire movement", "fire",
  "early retirement", "emergency fund", "rule of 25", "rule of 72",
  "advisor", "advice", "plan", "planning", "projection", "trajectory",
  "compound interest", "dividend", "dividends", "yield", "rmd",
  "hsa", "sep", "simple ira", "vesting", "match", "employer",
];

const GREETINGS = /^(hi|hello|hey|yo|namaste|good (morning|afternoon|evening)|sup|howdy)\b[!.\s]*$/i;
const THANKS = /^(thanks|thank you|ty|cheers|appreciate)\b/i;
const HELP_QUERY = /^(help|what can you do|what do you do|how (do|does) (this|you) work|capabilities)\b/i;
const CALC_INTENT = /(calculate|compute|project|how much|will i have|enough|on track|plan for me|my retirement|build (a|my) plan|run the numbers)/i;

const DISCLAIMER =
  "\n\n_⚠️ Educational guidance only — not professional financial advice. Please consult a certified advisor for personal decisions._";

/** Identify which key planning inputs are missing from the chat context. */
function missingInputs(ctx: Partial<RetirementResult & RetirementInput>): string[] {
  const missing: string[] = [];
  if (!isFiniteNumber(ctx.currentAge)) missing.push("your **current age**");
  if (!isFiniteNumber(ctx.retirementAge)) missing.push("your **target retirement age**");
  if (!isFiniteNumber(ctx.currentSavings)) missing.push("your **current savings (₹)**");
  if (!isFiniteNumber(ctx.monthlyContribution))
    missing.push("how much you **invest each month (₹)**");
  if (!isFiniteNumber(ctx.monthlyRetirementExpenses))
    missing.push("your **expected monthly expenses in retirement (₹)**");
  return missing;
}

function isOnTopic(message: string): boolean {
  const m = message.toLowerCase();
  return RETIREMENT_KEYWORDS.some((kw) => m.includes(kw));
}

function generateAdvice({ message, context }: ChatMessageInput): string {
  const raw = message.trim();
  const m = raw.toLowerCase();
  const ctx = context ?? {};

  // Allowed conversational shortcuts
  if (GREETINGS.test(raw)) {
    return "Hi! I'm your **Retirement Savings Advisor**. I can help with retirement projections, the 4% rule, compound growth, monthly contributions, asset allocation, taxes, inflation, and closing your savings gap.\n\nTell me a bit about yourself — your **current age**, **target retirement age**, **current savings**, **monthly investment**, and **expected monthly expenses in retirement** — and I'll run the numbers.";
  }
  if (THANKS.test(raw)) {
    return "You're welcome — happy to keep planning your retirement with you.";
  }
  if (HELP_QUERY.test(raw)) {
    return "I'm a focused **retirement advisory** assistant. Ask me about:\n• The 4% safe-withdrawal rule\n• Compound interest & projections\n• Monthly investments & savings goals\n• Asset allocation by age\n• Closing your savings gap\n• Tax-advantaged accounts (401k, IRA, Roth, NPS, PPF)\n• Inflation, emergency funds & retirement income" + DISCLAIMER;
  }

  // Hard topic guard — reject anything not retirement-related
  if (!isOnTopic(m)) {
    return "I'm a **retirement advisory** assistant and can only answer questions about retirement planning — things like the 4% rule, compound growth, contributions, allocation, taxes, or your savings gap. Could you rephrase your question in that context?";
  }

  // If the user asks for a calculation but key inputs are missing, ask for them
  if (CALC_INTENT.test(m)) {
    const missing = missingInputs(ctx);
    if (missing.length) {
      return (
        "Happy to run the numbers. To give you an accurate projection, I need:\n• " +
        missing.join("\n• ") +
        "\n\nYou can fill these in the **Planner** form on the left, or just type them here." +
        DISCLAIMER
      );
    }
    if (ctx.projectedCorpus && ctx.targetCorpus) {
      const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
      return (
        `Based on your inputs, you're projected to have **${fmt(ctx.projectedCorpus)}** by retirement, ` +
        `against a target of **${fmt(ctx.targetCorpus)}** (25× annual expenses, per the 4% rule). ` +
        (ctx.onTrack
          ? "You're **on track** — keep going! 🎯"
          : `You're short by **${fmt(ctx.savingsGap ?? 0)}**. Consider raising your monthly investment to **${fmt(ctx.suggestedMonthlyContribution ?? 0)}**.`) +
        DISCLAIMER
      );
    }
  }

  if (/4%|withdrawal|safe withdrawal|rule of 25/.test(m)) {
    return "The **4% rule** suggests you can withdraw 4% of your portfolio in year one of retirement, then adjust for inflation each year — historically lasting ~30 years. That's why your target corpus is roughly **25× your annual expenses**." + DISCLAIMER;
  }

  if (/compound|interest|growth|rule of 72/.test(m)) {
    return "**Compound interest** is the engine of retirement. Each month, returns earn returns on themselves. Starting 10 years earlier can easily **double** your final corpus — time matters more than amount.\n\n_Rule of 72_: divide 72 by your return rate to estimate how many years your money takes to double (e.g. 12% → ~6 years)." + DISCLAIMER;
  }

  if (/risk|allocation|stocks?|bonds?|equit|portfolio|etf|index fund|diversif|rebalance/.test(m)) {
    const lvl = ctx.riskLevel ?? "Balanced";
    if (lvl === "Aggressive")
      return "With 25+ years until retirement, an **aggressive** allocation (~80–90% equities) is usually appropriate. Volatility is your friend when you're buying every month." + DISCLAIMER;
    if (lvl === "Conservative")
      return "With under 10 years left, shift toward **capital preservation**: ~40–60% equities, the rest in high-quality bonds and short-duration instruments." + DISCLAIMER;
    return "A **balanced** mix (~60–70% equities, the rest in bonds) suits a 10–25 year horizon. Rebalance once a year." + DISCLAIMER;
  }

  if (/gap|short|behind|catch.?up|shortfall/.test(m)) {
    if (ctx.savingsGap && ctx.savingsGap > 0 && ctx.suggestedMonthlyContribution) {
      return `You're projected to fall short by **₹${ctx.savingsGap.toLocaleString("en-IN")}**. To close the gap, increase your monthly contribution to about **₹${ctx.suggestedMonthlyContribution.toLocaleString("en-IN")}**, or consider working a few extra years.` + DISCLAIMER;
    }
    return "Three levers close a savings gap: (1) **save more** each month, (2) **work longer**, (3) **reduce planned expenses**. Even small monthly increases compound dramatically." + DISCLAIMER;
  }

  if (/inflation/.test(m)) {
    return "Assume **5–6% inflation** long-term in India. Your monthly expense input should reflect *today's* rupees — the 4% rule already bakes in inflation-adjusted withdrawals." + DISCLAIMER;
  }

  if (/tax|401k|401\(k\)|ira|roth|hsa|sep|rmd|vesting|employer|match/.test(m)) {
    return "Maximize **tax-advantaged accounts** first: employer match → Roth IRA → max 401(k). In India, look at **EPF, PPF, NPS, and ELSS** under Section 80C/80CCD. A Roth is especially powerful when you're in a low tax bracket today." + DISCLAIMER;
  }

  if (/emergency.*fund|emergency/.test(m)) {
    return "Keep **3–6 months of expenses** in a high-yield savings account *before* aggressive investing. It prevents you from selling investments at the worst time." + DISCLAIMER;
  }

  if (/social security|medicare|annuity|pension/.test(m)) {
    return "Treat **Social Security / pensions / annuities** as a *floor*, not a plan. Delaying Social Security to age 70 increases benefits by ~8% per year of delay after full retirement age." + DISCLAIMER;
  }

  if (/dividend|yield/.test(m)) {
    return "Dividends can supplement retirement income, but **total return** matters more than yield. Don't chase high yields — they often signal elevated risk." + DISCLAIMER;
  }

  if (/fire|early retirement/.test(m)) {
    return "**FIRE** (Financial Independence, Retire Early) usually targets **25–30× annual expenses** saved. The math: a higher savings rate matters far more than investment returns in the early years." + DISCLAIMER;
  }

  if (/income|monthly income/.test(m)) {
    if (ctx.monthlyIncomeEstimate) {
      return `At a 4% safe withdrawal rate, your projected corpus would generate roughly **₹${ctx.monthlyIncomeEstimate.toLocaleString("en-IN")}/month** in retirement income.` + DISCLAIMER;
    }
    return "Your monthly retirement income ≈ **(corpus × 4%) ÷ 12**. Fill in the planner to see your personal estimate." + DISCLAIMER;
  }

  if (ctx.onTrack === true) {
    return "Good news — you're projected to be **on track**. Stay consistent, rebalance annually, and revisit this plan every 12 months." + DISCLAIMER;
  }
  if (ctx.onTrack === false) {
    return `You're currently **off-track**. Try increasing your monthly contribution to ~₹${(ctx.suggestedMonthlyContribution ?? 0).toLocaleString("en-IN")} or extending your retirement age by 2–3 years.` + DISCLAIMER;
  }

  return "I can help with the 4% rule, compound interest, monthly investments, asset allocation, closing your savings gap, taxes, and inflation. What would you like to dig into?" + DISCLAIMER;
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
