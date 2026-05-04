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
  "\n\n_⚠️ Just a friendly tip — not real financial advice. Please talk to a qualified advisor before making big money decisions._";

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
    return "Hi! 👋 I'm your **Retirement Helper**. I can explain things in simple words — like how much to save, the 4% rule, how your money grows, where to invest, and how taxes work.\n\nTo plan for you, just tell me:\n• Your **age now**\n• The **age you want to retire**\n• How much you've **saved so far**\n• How much you **save each month**\n• How much you'll **spend each month after retiring**";
  }
  if (THANKS.test(raw)) {
    return "You're welcome! 😊 Happy to help anytime.";
  }
  if (HELP_QUERY.test(raw)) {
    return "I'm a simple **retirement helper**. You can ask me things like:\n• What is the 4% rule?\n• How does compound interest work?\n• How much should I save every month?\n• Where should I put my money — stocks or bonds?\n• How do I catch up if I'm behind?\n• Which accounts save the most tax (401k, IRA, Roth, NPS, PPF)?\n• How much do I need to retire?" + DISCLAIMER;
  }

  // Hard topic guard — reject anything not retirement-related
  if (!isOnTopic(m)) {
    return "I can only help with **retirement questions** — like saving, investing, the 4% rule, taxes, or planning your retirement income. Could you ask your question in that way?";
  }

  // If the user asks for a calculation but key inputs are missing, ask for them
  if (CALC_INTENT.test(m)) {
    const missing = missingInputs(ctx);
    if (missing.length) {
      return (
        "Sure, I can do the math for you! I just need a few details:\n• " +
        missing.join("\n• ") +
        "\n\nYou can type them here, or fill the **Planner** form on the left." +
        DISCLAIMER
      );
    }
    if (ctx.projectedCorpus && ctx.targetCorpus) {
      const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
      return (
        `Here's what I see: by the time you retire, you'll likely have **${fmt(ctx.projectedCorpus)}**. ` +
        `You need around **${fmt(ctx.targetCorpus)}** (that's 25 times your yearly spending — the 4% rule). ` +
        (ctx.onTrack
          ? "Great news — you're **on track**! Just keep going. 🎯"
          : `You're a bit short — by **${fmt(ctx.savingsGap ?? 0)}**. Try saving **${fmt(ctx.suggestedMonthlyContribution ?? 0)}** every month to catch up.`) +
        DISCLAIMER
      );
    }
  }

  if (/4%|withdrawal|safe withdrawal|rule of 25/.test(m)) {
    return "The **4% rule** is simple: in your first year of retirement, take out 4% of your savings to live on. Each year after, take a little more to keep up with prices. Your money should last about 30 years.\n\nQuick trick: you need about **25 times your yearly spending** saved up to retire safely." + DISCLAIMER;
  }

  if (/compound|interest|growth|rule of 72/.test(m)) {
    return "**Compound interest** means your money earns money — and then *that* money also earns money. Over time, it grows really fast. 🌱\n\nStarting **10 years earlier** can almost **double** what you end up with. Time matters more than amount!\n\n_Easy trick (Rule of 72)_: divide 72 by your return rate to see how many years it takes your money to double. Example: 12% return → ~6 years to double." + DISCLAIMER;
  }

  if (/risk|allocation|stocks?|bonds?|equit|portfolio|etf|index fund|diversif|rebalance/.test(m)) {
    const lvl = ctx.riskLevel ?? "Balanced";
    if (lvl === "Aggressive")
      return "You have lots of time (25+ years), so you can take more risk. Put most of your money (around **80–90%**) in **stocks**. Ups and downs are okay — they actually help when you're buying every month." + DISCLAIMER;
    if (lvl === "Conservative")
      return "You're getting close to retirement (under 10 years), so play it safer. Keep about **40–60% in stocks** and the rest in **bonds** or safer options. The goal now is to protect what you have." + DISCLAIMER;
    return "A **balanced mix** works well for you: about **60–70% in stocks** and the rest in **bonds**. Check it once a year and adjust if needed." + DISCLAIMER;
  }

  if (/gap|short|behind|catch.?up|shortfall/.test(m)) {
    if (ctx.savingsGap && ctx.savingsGap > 0 && ctx.suggestedMonthlyContribution) {
      return `Looks like you're short by **₹${ctx.savingsGap.toLocaleString("en-IN")}**. To catch up, try saving about **₹${ctx.suggestedMonthlyContribution.toLocaleString("en-IN")}** every month — or work a couple of extra years before retiring.` + DISCLAIMER;
    }
    return "Three easy ways to catch up:\n1. **Save more** each month\n2. **Work a few more years**\n3. **Spend a little less** in retirement\n\nEven small extra savings add up over time!" + DISCLAIMER;
  }

  if (/inflation/.test(m)) {
    return "**Inflation** means things cost more over time. In India, plan for prices to go up about **5–6% every year**. When you tell me your monthly expenses, use **today's prices** — the 4% rule already handles future price increases for you." + DISCLAIMER;
  }

  if (/tax|401k|401\(k\)|ira|roth|hsa|sep|rmd|vesting|employer|match/.test(m)) {
    return "Save tax first, then invest more!\n• If your job offers a **401(k) match**, take it — it's free money\n• Then put money in a **Roth IRA** (grows tax-free)\n• In India, use **EPF, PPF, NPS, and ELSS** to save tax under Section 80C/80CCD\n\nA Roth account works great when you don't pay much tax today." + DISCLAIMER;
  }

  if (/emergency.*fund|emergency/.test(m)) {
    return "Before investing big, save **3 to 6 months of expenses** in a regular savings account. This way, if something goes wrong, you don't have to sell your investments at a bad time." + DISCLAIMER;
  }

  if (/social security|medicare|annuity|pension/.test(m)) {
    return "Pensions and **Social Security** are nice to have, but don't depend on them alone. They should be a **safety net**, not your full plan. If you can wait until age 70 to claim Social Security, you get about **8% more per year** for waiting." + DISCLAIMER;
  }

  if (/dividend|yield/.test(m)) {
    return "**Dividends** are small payouts companies give to shareholders. They can add to your income, but don't only chase high dividends — sometimes that means more risk. Look at **total growth**, not just the payout." + DISCLAIMER;
  }

  if (/fire|early retirement/.test(m)) {
    return "**FIRE** stands for *Financial Independence, Retire Early*. The idea: save **25 to 30 times your yearly spending** as fast as you can. The trick isn't picking great investments — it's **saving a lot of your income** every month." + DISCLAIMER;
  }

  if (/income|monthly income/.test(m)) {
    if (ctx.monthlyIncomeEstimate) {
      return `Using the 4% rule, your savings would give you about **₹${ctx.monthlyIncomeEstimate.toLocaleString("en-IN")} every month** in retirement.` + DISCLAIMER;
    }
    return "Easy formula: **(your savings × 4%) ÷ 12 = monthly income**. Fill in the planner and I'll calculate it for you." + DISCLAIMER;
  }

  if (ctx.onTrack === true) {
    return "Great job — you're **on track**! 🎉 Just keep saving the same amount, check once a year, and you'll reach your goal." + DISCLAIMER;
  }
  if (ctx.onTrack === false) {
    return `Right now you're a little **behind**. Don't worry — try saving about **₹${(ctx.suggestedMonthlyContribution ?? 0).toLocaleString("en-IN")}** each month, or plan to retire 2 to 3 years later. Either one helps a lot.` + DISCLAIMER;
  }

  return "I can help you with the 4% rule, how money grows, monthly savings, where to invest, taxes, and how to catch up if you're behind. What would you like to know?" + DISCLAIMER;
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
