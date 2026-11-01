import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import {
  IconArrowRight,
  IconCheck,
  IconRobot,
  IconScale,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIES = ["food", "groceries", "transport", "stay", "activities", "utilities", "shopping", "other"] as const;
type Mode = "equal" | "exact" | "percent" | "shares";

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

const selectCls = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function Card({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid content-start gap-3 rounded-xl border bg-card p-4", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    pending_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
    void: "bg-muted text-muted-foreground line-through",
  };
  const label: Record<string, string> = {
    approved: "counted",
    pending_approval: "needs approval",
    rejected: "blocked",
    void: "removed",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", map[status])}>{label[status] ?? status}</span>;
}

function SourceBadge({ source }: { source: string }) {
  return source === "agent" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
      <IconRobot className="size-3" /> agent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
      <IconUser className="size-3" /> you
    </span>
  );
}

export default function PotRoute() {
  const { potId = "" } = useParams();
  const { data, isLoading, error } = useActionQuery("get-pot", { potId });

  if (error)
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        <p className="text-muted-foreground">{actionErrorMessage(error) ?? "Could not open this pot."}</p>
        <Link to="/pots" className="mt-4 inline-block underline">
          Back to pots
        </Link>
      </main>
    );
  if (isLoading || !data)
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Skeleton className="h-[420px]" />
          <div className="grid gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </main>
    );
  return <PotView data={data} />;
}

type PotData = NonNullable<ReturnType<typeof useActionQuery<undefined, "get-pot">>["data"]>;

function PotView({ data }: { data: PotData }) {
  const { pot, members, balances, transfers, expenses, rules, activity, totals } = data;
  const cur = pot.currency;
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Former member";
  const pending = expenses.filter((e) => e.status === "pending_approval");
  const ask = (message: string) => sendToAgentChat({ message, submit: true, context: `Current pot: ${pot.name} (potId ${pot.id})` });

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/pots" className="text-xs text-muted-foreground hover:underline">
            Pots
          </Link>
          <h1 className="text-2xl font-semibold">{pot.name}</h1>
          <p className="text-sm text-muted-foreground">
            {totals.approvedSpendFormatted} counted · {members.length} people
            {totals.pendingCount ? ` · ${totals.pendingCount} waiting for approval` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => ask("Who owes whom in this pot, and what's the fastest way to settle up?")}>
            <IconSparkles className="size-4" /> Explain balances
          </Button>
          <Button variant="outline" size="sm" onClick={() => ask("Summarise this pot's spending by category and person, and flag anything unusual.")}>
            <IconSparkles className="size-4" /> Spending recap
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-5">
          <AddExpense potId={pot.id} currency={cur} members={members} />
          <AskCopilot onAsk={ask} />
          <Members potId={pot.id} members={members} />
        </div>

        <div className="grid content-start gap-5">
          {pending.length > 0 && (
            <Card title="Waiting for a person to approve" icon={<IconShieldCheck className="size-4 text-amber-600" />} className="border-amber-500/50">
              <ul className="grid gap-3">
                {pending.map((e) => (
                  <PendingItem key={e.id} expense={e} members={members} needed={rules.approvalsRequired} />
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Balances" icon={<IconScale className="size-4" />}>
              <ul className="grid gap-1.5">
                {balances.map((b) => (
                  <li key={b.memberId} className="flex items-center justify-between text-sm">
                    <span>{b.name}</span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        b.net > 0 && "text-emerald-600 dark:text-emerald-400",
                        b.net < 0 && "text-red-600 dark:text-red-400",
                        b.net === 0 && "text-muted-foreground",
                      )}
                    >
                      {b.net > 0 ? "gets " : b.net < 0 ? "owes " : ""}
                      {money(Math.abs(b.net), cur)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <SettleUp potId={pot.id} currency={cur} transfers={transfers} />
          </div>

          <Card title="Expenses">
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Add a bill on the left or tell the agent about one.</p>
            ) : (
              <ul className="divide-y">
                {expenses.map((e) => (
                  <ExpenseRow key={e.id} e={e} currency={cur} name={name} />
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <RulesCard potId={pot.id} currency={cur} rules={rules} />
            <Card title="Activity">
              <ul className="grid max-h-72 gap-2 overflow-y-auto text-xs">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span className="shrink-0">{a.actor === "agent" ? <IconRobot className="size-3.5 text-violet-500" /> : <IconUser className="size-3.5 text-sky-500" />}</span>
                    <span className="text-muted-foreground">{a.summary}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function AddExpense({ potId, currency, members }: { potId: string; currency: string; members: PotData["members"] }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("food");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("equal");
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const add = useActionMutation("add-expense", {
    onSuccess: (res) => {
      if (res.status === "approved") toast.success(`${res.description} added`);
      else if (res.status === "pending_approval") toast.warning(`${res.description} needs approval: ${res.reasons[0]}`);
      else toast.error(`Blocked: ${res.reasons[0]}`);
      setDescription("");
      setAmount("");
      setValues({});
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Could not add the expense"),
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!description.trim() || !amount) return toast.error("Add what it was for and the amount");
    const splitWith = members.filter((m) => included[m.id] !== false).map((m) => m.id);
    const splitValues: Record<string, number> = {};
    if (mode !== "equal")
      for (const [id, v] of Object.entries(values)) if (v && Number(v) > 0) splitValues[id] = Number(v);
    add.mutate({
      potId,
      description: description.trim(),
      amount: amount.replace(/,/g, ""),
      category,
      paidBy: paidBy || members[0]?.id,
      splitMode: mode,
      ...(mode === "equal" ? { splitWith } : { splitValues }),
    } as never);
  };

  const unit = mode === "exact" ? currency : mode === "percent" ? "%" : "shares";
  return (
    <Card title="Add a bill">
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <div className="grid gap-1">
            <Label htmlFor="exp-desc">What for</Label>
            <Input id="exp-desc" placeholder="Dinner at Thalassa" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="exp-amount">Amount ({currency})</Label>
            <Input id="exp-amount" inputMode="decimal" placeholder="2400" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="exp-cat">Category</Label>
            <select id="exp-cat" className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as never)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="exp-paid">Paid by</Label>
            <select id="exp-paid" className={selectCls} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Split</Label>
          <div className="flex rounded-md border p-0.5 text-xs">
            {(["equal", "exact", "percent", "shares"] as Mode[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={cn("flex-1 rounded px-2 py-1 capitalize", mode === m ? "bg-foreground text-background" : "text-muted-foreground")}
              >
                {m}
              </button>
            ))}
          </div>
          <ul className="grid gap-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                {mode === "equal" ? (
                  <label className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={included[m.id] !== false}
                      onChange={(e) => setIncluded((s) => ({ ...s, [m.id]: e.target.checked }))}
                    />
                    {m.name}
                  </label>
                ) : (
                  <>
                    <span>{m.name}</span>
                    <span className="flex items-center gap-1">
                      <Input
                        className="h-8 w-24"
                        inputMode="decimal"
                        aria-label={`${m.name} ${unit}`}
                        value={values[m.id] ?? ""}
                        onChange={(e) => setValues((s) => ({ ...s, [m.id]: e.target.value }))}
                      />
                      <span className="w-12 text-xs text-muted-foreground">{unit}</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Checking rules…" : "Add bill"}
        </Button>
      </form>
    </Card>
  );
}

function AskCopilot({ onAsk }: { onAsk: (m: string) => void }) {
  const [text, setText] = useState("");
  const examples = [
    "Dinner 2,400 paid by Aisha, everyone except Ravi",
    "Cab to airport 1,150 paid by Ravi, split with Meera",
    "Raise the per-bill cap to 5,000",
  ];
  return (
    <Card title="Tell the copilot" icon={<IconSparkles className="size-4 text-violet-500" />}>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAsk(text.trim());
          setText("");
        }}
      >
        <textarea
          className="min-h-20 rounded-md border bg-background p-2 text-sm"
          placeholder="Paste a receipt, a WhatsApp message, or just say what happened…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Send to agent
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((x) => (
          <button key={x} type="button" onClick={() => onAsk(x)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            {x}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Members({ potId, members }: { potId: string; members: PotData["members"] }) {
  const [name, setName] = useState("");
  const add = useActionMutation("add-member", {
    onSuccess: () => setName(""),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Could not add"),
  });
  return (
    <Card title="People" icon={<IconUserPlus className="size-4" />}>
      <div className="flex flex-wrap gap-1.5">
        {members.map((m) => (
          <span key={m.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {m.name}
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate({ potId, name: name.trim() } as never);
        }}
      >
        <Input className="h-8" placeholder="Add someone" value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" type="submit" variant="outline" disabled={add.isPending}>
          Add
        </Button>
      </form>
    </Card>
  );
}

function PendingItem({ expense, members, needed }: { expense: PotData["expenses"][number]; members: PotData["members"]; needed: number }) {
  const notPayer = members.filter((m) => m.id !== expense.paidBy && !expense.approvals.includes(m.id));
  const [who, setWho] = useState(notPayer[0]?.id ?? members[0]?.id ?? "");
  const review = useActionMutation("review-expense", {
    onSuccess: (r) => toast.success(r.status === "approved" ? "Approved and counted" : r.status === "rejected" ? "Rejected" : "Approval recorded"),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Could not record that"),
  });
  return (
    <li className="grid gap-2 rounded-lg bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {expense.description} · {expense.amountFormatted}
          </p>
          <p className="text-xs text-muted-foreground">
            Paid by {expense.paidByName} · {expense.reasons.join(" · ")} · {expense.approvals.length}/{needed} approvals
          </p>
        </div>
        <SourceBadge source={expense.source} />
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {expense.checks.map((c) => (
          <li key={c.name} className={cn("rounded px-1.5 py-0.5 text-[11px]", c.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300")}>
            {c.ok ? "✓" : "✕"} {c.name}: {c.detail}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Approve as</span>
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ expenseId: expense.id, memberId: who, decision: "approve" } as never)}>
          <IconCheck className="size-4" /> Approve
        </Button>
        <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ expenseId: expense.id, memberId: who, decision: "reject" } as never)}>
          <IconX className="size-4" /> Reject
        </Button>
      </div>
    </li>
  );
}

function SettleUp({ potId, currency, transfers }: { potId: string; currency: string; transfers: PotData["transfers"] }) {
  const settle = useActionMutation("record-settlement", {
    onSuccess: (r) => toast.success(r.summary),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Could not record it"),
  });
  return (
    <Card title="Settle up" icon={<IconArrowRight className="size-4" />}>
      {transfers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everyone is square.</p>
      ) : (
        <ul className="grid gap-2">
          {transfers.map((t) => (
            <li key={`${t.from}-${t.to}`} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <b>{t.fromName}</b> pays <b>{t.toName}</b> <span className="tabular-nums">{money(t.amount, currency)}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={settle.isPending}
                onClick={() => settle.mutate({ potId, from: t.from, to: t.to, amount: (t.amount / 100).toFixed(2), note: "settled in app" } as never)}
              >
                Mark paid
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Fewest payments that clear every balance. Recording only; pay by UPI or cash.</p>
    </Card>
  );
}

function ExpenseRow({ e, currency, name }: { e: PotData["expenses"][number]; currency: string; name: (id: string) => string }) {
  const voidIt = useActionMutation("void-expense", { onError: (err) => toast.error(actionErrorMessage(err) ?? "Could not remove") });
  const split = Object.entries(e.splits)
    .map(([id, s]) => `${name(id)} ${money(s, currency)}`)
    .join(" · ");
  return (
    <li className={cn("flex items-start justify-between gap-3 py-2.5", e.status === "void" && "opacity-50")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{e.description}</span>
          <StatusBadge status={e.status} />
          <SourceBadge source={e.source} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {e.category} · {e.spentOn} · paid by {e.paidByName} · {split}
        </p>
        {e.status === "rejected" && <p className="text-xs text-red-600 dark:text-red-400">{e.reasons.join("; ")}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="font-medium tabular-nums">{e.amountFormatted}</span>
        {e.status !== "void" && (
          <button type="button" aria-label="Remove expense" className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => voidIt.mutate({ expenseId: e.id } as never)}>
            <IconTrash className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

function RulesCard({ potId, currency, rules }: { potId: string; currency: string; rules: PotData["rules"] }) {
  const [cap, setCap] = useState(String(rules.perExpenseCap / 100));
  const [daily, setDaily] = useState(String(rules.dailyCap / 100));
  const [approvals, setApprovals] = useState(String(rules.approvalsRequired));
  const [cats, setCats] = useState<string[]>(rules.allowedCategories);
  const dirty = useMemo(
    () =>
      cap !== String(rules.perExpenseCap / 100) ||
      daily !== String(rules.dailyCap / 100) ||
      approvals !== String(rules.approvalsRequired) ||
      cats.join() !== rules.allowedCategories.join(),
    [cap, daily, approvals, cats, rules],
  );
  const save = useActionMutation("update-rules", {
    onSuccess: () => toast.success("Rules updated"),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Could not save rules"),
  });
  const key = `${rules.perExpenseCap}-${rules.dailyCap}-${rules.approvalsRequired}-${rules.allowedCategories.join()}`;
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setCap(String(rules.perExpenseCap / 100));
    setDaily(String(rules.dailyCap / 100));
    setApprovals(String(rules.approvalsRequired));
    setCats(rules.allowedCategories);
  }
  return (
    <Card title="Group rules" icon={<IconShieldCheck className="size-4" />}>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Per-bill cap</Label>
          <Input className="h-8" value={cap} onChange={(e) => setCap(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Daily cap</Label>
          <Input className="h-8" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Approvals</Label>
          <Input className="h-8" value={approvals} onChange={(e) => setApprovals(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const on = cats.includes(c);
          return (
            <button
              type="button"
              key={c}
              onClick={() => setCats((s) => (on ? s.filter((x) => x !== c) : [...s, c]))}
              className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-emerald-500/60 bg-emerald-500/10" : "text-muted-foreground line-through")}
            >
              {c}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Caps in {currency}. The same rules apply whether a bill comes from this form or from the agent, and only a person can approve.
      </p>
      <Button
        size="sm"
        disabled={!dirty || save.isPending}
        onClick={() =>
          save.mutate({
            potId,
            perExpenseCap: Number(cap),
            dailyCap: Number(daily),
            approvalsRequired: Number(approvals),
            allowedCategories: cats,
          } as never)
        }
      >
        Save rules
      </Button>
    </Card>
  );
}
