import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
import {
  calculateRetirement,
  type RetirementInput,
  type RetirementResult,
} from "@/server/retirement";
import { PlannerForm } from "@/components/PlannerForm";
import { Dashboard } from "@/components/Dashboard";
import { Chatbot } from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Pensive — Retirement Advisory Co-pilot" },
      {
        name: "description",
        content:
          "Plan your retirement with a real-time projection engine and an AI co-pilot. Compound growth, the 4% rule, and your savings gap — instantly.",
      },
      { property: "og:title", content: "Pensive — Retirement Advisory" },
      {
        property: "og:description",
        content:
          "Real-time retirement projections + an AI co-pilot for compound growth, the 4% rule, and closing your savings gap.",
      },
    ],
  }),
});

const DEFAULTS: RetirementInput = {
  currentAge: 30,
  retirementAge: 60,
  currentSavings: 500000,
  monthlyContribution: 25000,
  expectedAnnualReturn: 12,
  monthlyRetirementExpenses: 60000,
};

const STORAGE_KEY = "retirement_planner_inputs_v1";

function Home() {
  const [values, setValues] = useState<RetirementInput>(DEFAULTS);
  const [result, setResult] = useState<RetirementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // hydrate inputs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setValues({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // persist + recalc (debounced)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await calculateRetirement({ data: values });
        setResult(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Calculation failed");
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [values]);

  const reset = () => {
    setValues(DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
  };

  const headline = useMemo(() => {
    if (!result) return "Plan retirement with clarity.";
    return result.onTrack
      ? "You're on track. Keep compounding."
      : "Let's close the gap, together.";
  }, [result]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-accent" />
            <div className="absolute inset-0.5 rounded-[7px] bg-background" />
            <div className="absolute inset-0 grid place-items-center text-xs font-bold text-gradient">
              P
            </div>
          </div>
          <span className="text-base font-semibold tracking-tight">
            Pensive
          </span>
          <span className="ml-2 hidden rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#planner"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
          >
            Planner
          </a>
          <a
            href="#chat"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-block"
          >
            Co-pilot
          </a>
          <Link
            to="/health"
            className="hidden items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            API
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-7xl px-6 pb-12 pt-12 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" /> AI-assisted financial
            clarity
          </div>
          <h1 className="mt-5 text-[44px] font-semibold leading-[1.05] tracking-tight md:text-[72px]">
            <span className="text-gradient">{headline}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            A real-time projection engine paired with a context-aware co-pilot.
            Built on compound growth, the 4% safe-withdrawal rule, and an
            honest savings gap analysis.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#planner"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Start planning
              <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href="#chat"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-3 text-sm font-medium backdrop-blur transition hover:bg-card"
            >
              Talk to co-pilot
            </a>
          </div>
        </motion.div>
      </section>

      {/* planner + dashboard */}
      <section
        id="planner"
        className="relative mx-auto max-w-7xl px-6 pb-12"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <PlannerForm
            values={values}
            onChange={setValues}
            onReset={reset}
            loading={loading}
          />
          <Dashboard data={result} error={error} />
        </div>
      </section>

      {/* chat */}
      <section id="chat" className="relative mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Co-pilot
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              Ask anything about your retirement plan
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Scoped strictly to retirement topics — off-topic questions are politely declined.
            </p>
          </div>
        </div>
        <Chatbot context={result} />
      </section>

      {/* disclaimer */}
      <footer className="relative mx-auto max-w-7xl px-6 pb-16">
        <div className="glass-card flex flex-col items-start gap-3 rounded-2xl p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                Financial disclaimer.
              </span>{" "}
              Pensive provides general educational projections, not personalized
              financial, tax, or investment advice. Numbers are estimates based
              on the inputs you provide. Consult a licensed advisor before
              making decisions.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Pensive
          </span>
        </div>
      </footer>
    </div>
  );
}
