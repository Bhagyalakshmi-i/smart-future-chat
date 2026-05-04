import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Trash2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { chatRespond, type RetirementResult } from "@/server/retirement";

type Msg = {
  id: string;
  role: "user" | "bot";
  text: string;
  at: number;
};

const STORAGE_KEY = "retirement_chat_history_v1";

const STARTERS = [
  "Explain the 4% rule",
  "How can I close my savings gap?",
  "What allocation suits me?",
  "Tell me about compound interest",
  "Roth IRA vs 401(k)?",
];

const SUGGESTION_GROUPS: { label: string; prompts: string[] }[] = [
  {
    label: "Basics",
    prompts: [
      "Explain the 4% rule",
      "What is compound interest?",
      "How much should I save each month?",
      "When can I retire?",
    ],
  },
  {
    label: "My plan",
    prompts: [
      "Am I on track?",
      "How can I close my savings gap?",
      "What allocation suits me?",
      "How does inflation affect my goal?",
    ],
  },
  {
    label: "Accounts & taxes",
    prompts: [
      "Roth IRA vs 401(k)?",
      "Should I max my employer match?",
      "Tax-efficient withdrawal order?",
      "What about HSA for retirement?",
    ],
  },
];

export function Chatbot({ context }: { context: RetirementResult | null }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(SUGGESTION_GROUPS[0].label);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        text: "Hi 👋 I'm your retirement co-pilot. I can **only** answer questions about retirement planning — projections, the 4% rule, contributions, allocation, taxes, and your savings gap. Ask away.",
        at: Date.now(),
      },
    ]);
  }, []);

  // persist
  useEffect(() => {
    if (messages.length)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      at: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await chatRespond({
        data: { message: trimmed, context: context ?? undefined },
      });
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: res.reply,
          at: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text:
            err instanceof Error
              ? `Sorry — ${err.message}`
              : "Something went wrong. Please try again.",
          at: Date.now(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        text: "Cleared. What would you like to explore next?",
        at: Date.now(),
      },
    ]);
  };

  return (
    <div className="glass-card flex h-[640px] flex-col overflow-hidden rounded-3xl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
          </div>
          <div>
            <p className="text-sm font-semibold">Retirement co-pilot</p>
            <p className="text-xs text-muted-foreground">
              {typing ? "Typing…" : "Online · context-aware"}
            </p>
          </div>
        </div>
        <button
          onClick={clear}
          aria-label="Clear chat"
          className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex items-end gap-2 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "bot" && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-card/70 text-foreground"
                }`}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownSafe(m.text),
                }}
              />
              {m.role === "user" && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {typing && (
          <div className="flex items-end gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-border bg-card/70 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground" />
              <span
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* suggestions */}
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setSuggestionsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Suggested questions
          </span>
          {suggestionsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        <AnimatePresence initial={false}>
          {suggestionsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 px-5 pb-2">
                {SUGGESTION_GROUPS.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => setActiveGroup(g.label)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      activeGroup === g.label
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 px-5 pb-3">
                {SUGGESTION_GROUPS.find((g) => g.label === activeGroup)!.prompts.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={typing}
                    className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-card hover:text-foreground disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-border p-3"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/60 px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about retirement only — 4% rule, allocation, taxes…"
            maxLength={1000}
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

/** Tiny markdown — bold + linebreaks, escapes HTML. */
function renderMarkdownSafe(s: string) {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}
