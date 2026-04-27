import { motion } from "framer-motion";
import { RotateCcw, Sparkles } from "lucide-react";
import type { RetirementInput } from "@/server/retirement";

type Props = {
  values: RetirementInput;
  onChange: (next: RetirementInput) => void;
  onReset: () => void;
  loading: boolean;
};

const fields: {
  key: keyof RetirementInput;
  label: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}[] = [
  { key: "currentAge", label: "Current age", min: 16, max: 90, step: 1 },
  { key: "retirementAge", label: "Retirement age", min: 30, max: 100, step: 1 },
  { key: "currentSavings", label: "Current savings", suffix: "₹", step: 1000 },
  {
    key: "monthlyContribution",
    label: "Monthly contribution",
    suffix: "₹",
    step: 50,
  },
  {
    key: "expectedAnnualReturn",
    label: "Expected annual return",
    suffix: "%",
    step: 0.5,
    min: 0,
    max: 20,
  },
  {
    key: "monthlyRetirementExpenses",
    label: "Monthly retirement expenses",
    suffix: "₹",
    step: 100,
  },
];

export function PlannerForm({ values, onChange, onReset, loading }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card rounded-3xl p-6 md:p-8"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Planner
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Your numbers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-saves as you type.
          </p>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            <div className="relative">
              {f.suffix && (
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {f.suffix}
                </span>
              )}
              <input
                type="number"
                inputMode="decimal"
                step={f.step ?? 1}
                min={f.min}
                max={f.max}
                value={Number.isFinite(values[f.key]) ? values[f.key] : 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onChange({
                    ...values,
                    [f.key]: Number.isFinite(v) ? v : 0,
                  });
                }}
                className={`w-full rounded-xl border border-border bg-background/60 py-3 ${
                  f.suffix ? "pl-8" : "pl-4"
                } pr-4 text-sm font-medium tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20`}
              />
            </div>
          </label>
        ))}
      </div>

      {loading && (
        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary" />
          Recalculating projection…
        </div>
      )}
    </motion.div>
  );
}
