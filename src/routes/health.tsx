import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { healthCheck } from "@/server/retirement";

export const Route = createFileRoute("/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "API Health — Pensive" },
      {
        name: "description",
        content:
          "Live status of the Pensive retirement advisory API. Latency, uptime checks, and recent probes.",
      },
    ],
  }),
});

type Probe = {
  id: string;
  ok: boolean;
  latencyMs: number;
  status: string;
  service: string;
  time: string;
  at: number;
  error?: string;
};

const MAX_HISTORY = 20;

function HealthPage() {
  const [probes, setProbes] = useState<Probe[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runProbe = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const res = await healthCheck();
      const latencyMs = Math.round(performance.now() - start);
      setProbes((p) =>
        [
          {
            id: crypto.randomUUID(),
            ok: res.status === "ok",
            latencyMs,
            status: res.status,
            service: res.service,
            time: res.time,
            at: Date.now(),
          },
          ...p,
        ].slice(0, MAX_HISTORY),
      );
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      setProbes((p) =>
        [
          {
            id: crypto.randomUUID(),
            ok: false,
            latencyMs,
            status: "error",
            service: "retirement-advisory",
            time: new Date().toISOString(),
            at: Date.now(),
            error: err instanceof Error ? err.message : "Request failed",
          },
          ...p,
        ].slice(0, MAX_HISTORY),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runProbe();
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (auto) {
      intervalRef.current = setInterval(runProbe, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [auto]);

  const latest = probes[0];
  const uptime =
    probes.length > 0
      ? Math.round((probes.filter((p) => p.ok).length / probes.length) * 1000) / 10
      : 0;
  const avgLatency =
    probes.length > 0
      ? Math.round(probes.reduce((s, p) => s + p.latencyMs, 0) / probes.length)
      : 0;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to planner
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> API status
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 pb-12 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-3xl p-6 md:p-8"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            System status
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {latest?.ok ? (
                <span className="text-gradient">All systems operational</span>
              ) : latest ? (
                <span className="text-destructive">Service degraded</span>
              ) : (
                <span className="text-muted-foreground">Checking…</span>
              )}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuto((v) => !v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  auto
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {auto ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
              </button>
              <button
                onClick={runProbe}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Run probe
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Status"
              value={latest?.ok ? "Healthy" : latest ? "Down" : "—"}
              tone={latest?.ok ? "ok" : latest ? "bad" : "neutral"}
            />
            <Stat
              label="Avg latency"
              value={probes.length ? `${avgLatency} ms` : "—"}
              tone="neutral"
            />
            <Stat
              label="Uptime (last 20)"
              value={probes.length ? `${uptime}%` : "—"}
              tone={uptime >= 99 ? "ok" : uptime >= 90 ? "neutral" : "bad"}
            />
          </div>
        </motion.div>

        {/* Endpoint card */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Endpoint
            </p>
            <code className="mt-2 block rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs">
              GET /api/health
            </code>
            <p className="mt-3 text-xs text-muted-foreground">
              Service: <span className="text-foreground">retirement-advisory</span>
            </p>
            {latest && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last probe: {new Date(latest.at).toLocaleTimeString()} · {latest.latencyMs} ms
              </p>
            )}
          </div>

          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last response
            </p>
            <pre className="mt-2 max-h-44 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
{latest
  ? JSON.stringify(
      latest.error
        ? { error: latest.error }
        : { status: latest.status, service: latest.service, time: latest.time },
      null,
      2,
    )
  : "// awaiting first probe…"}
            </pre>
          </div>
        </div>

        {/* History */}
        <div className="glass-card mt-6 rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent probes
            </p>
            <span className="text-xs text-muted-foreground">
              {probes.length}/{MAX_HISTORY}
            </span>
          </div>
          <div className="mt-3 divide-y divide-border">
            {probes.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No probes yet.</p>
            )}
            {probes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  {p.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium">
                    {p.ok ? "OK" : p.error ?? "FAIL"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
                  <span>{p.latencyMs} ms</span>
                  <span>{new Date(p.at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "neutral";
}) {
  const dot =
    tone === "ok"
      ? "bg-success"
      : tone === "bad"
        ? "bg-destructive"
        : "bg-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
