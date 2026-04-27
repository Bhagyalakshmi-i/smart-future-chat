import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  Wallet,
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RetirementResult } from "@/server/retirement";

type Props = { data: RetirementResult | null; error: string | null };

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export function Dashboard({ data, error }: Props) {
  if (error) {
    return (
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card grid place-items-center rounded-3xl p-12">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-full bg-muted" />
          <p className="text-sm text-muted-foreground">
            Enter your numbers to see your projection.
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      icon: CalendarClock,
      label: "Years left",
      value: `${data.yearsLeft}`,
      tint: "from-primary/20 to-primary/0",
    },
    {
      icon: TrendingUp,
      label: "Projected corpus",
      value: fmt(data.projectedCorpus),
      tint: "from-accent/30 to-accent/0",
    },
    {
      icon: Target,
      label: "Target corpus",
      value: fmt(data.targetCorpus),
      tint: "from-warning/30 to-warning/0",
    },
    {
      icon: AlertTriangle,
      label: "Savings gap",
      value: fmt(data.savingsGap),
      tint: "from-destructive/25 to-destructive/0",
      negative: data.savingsGap > 0,
    },
    {
      icon: Wallet,
      label: "Suggested monthly",
      value: fmt(data.suggestedMonthlyContribution),
      tint: "from-success/30 to-success/0",
    },
    {
      icon: ShieldCheck,
      label: "Monthly income (est.)",
      value: fmt(data.monthlyIncomeEstimate),
      tint: "from-primary/20 to-accent/10",
    },
  ];

  const progress = Math.min(
    100,
    data.targetCorpus > 0
      ? (data.projectedCorpus / data.targetCorpus) * 100
      : 0,
  );

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-3xl p-6 md:p-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trajectory
            </p>
            <h3 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              {data.onTrack ? (
                <span className="text-gradient">On track</span>
              ) : (
                <span>{progress.toFixed(0)}% of target</span>
              )}
            </h3>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              data.riskLevel === "Aggressive"
                ? "border-primary/30 bg-primary/10 text-primary"
                : data.riskLevel === "Conservative"
                  ? "border-warning/30 bg-warning/10 text-foreground"
                  : "border-accent/30 bg-accent/10 text-foreground"
            }`}
          >
            {data.riskLevel} profile
          </span>
        </div>

        <div className="relative mt-6 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.55 0.22 268), oklch(0.78 0.16 195))",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{fmt(data.projectedCorpus)}</span>
          <span>{fmt(data.targetCorpus)}</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="glass-card group relative overflow-hidden rounded-2xl p-5"
          >
            <div
              className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${c.tint} blur-2xl transition group-hover:scale-110`}
            />
            <div className="relative">
              <div className="flex items-center gap-2 text-muted-foreground">
                <c.icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  {c.label}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight md:text-[28px]">
                {c.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Projection chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="glass-card rounded-3xl p-5 md:p-6"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Projection
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
              Balance vs. target over time
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.55 0.22 268)" }} />
              Projected balance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.78 0.16 195)" }} />
              Contributions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-dashed border-warning" />
              Target
            </span>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.22 268)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.55 0.22 268)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="contribFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.02 260 / 0.18)" vertical={false} />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 11, fill: "oklch(0.6 0.02 260)" }}
                tickLine={false}
                axisLine={false}
                label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 11, fill: "oklch(0.55 0.02 260)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "oklch(0.6 0.02 260)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_00_00_000
                    ? `₹${(v / 1_00_00_000).toFixed(1)}Cr`
                    : v >= 1_00_000
                      ? `₹${(v / 1_00_000).toFixed(1)}L`
                      : `₹${Math.round(v / 1000)}k`
                }
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelFormatter={(label: number) => `Age ${label}`}
                formatter={(value: number, name: string) => [fmt(value), name]}
              />
              <Area
                type="monotone"
                dataKey="contributions"
                name="Contributions"
                stroke="oklch(0.78 0.16 195)"
                strokeWidth={2}
                fill="url(#contribFill)"
              />
              <Area
                type="monotone"
                dataKey="balance"
                name="Projected balance"
                stroke="oklch(0.55 0.22 268)"
                strokeWidth={2.5}
                fill="url(#balFill)"
              />
              <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke="oklch(0.78 0.18 75)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
