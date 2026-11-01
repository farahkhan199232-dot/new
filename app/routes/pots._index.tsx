import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { IconChevronRight, IconPlus, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

export default function PotsIndex() {
  const navigate = useNavigate();
  const { data, isLoading } = useActionQuery("list-pots", {});
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("INR");
  const create = useActionMutation("create-pot", {
    onSuccess: (res) => navigate(`/pots/${res.id}`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Could not create the pot"),
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const list = members.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (list.length < 2) return toast.error("Add at least two people, separated by commas");
    create.mutate({ name: name.trim() || "New pot", currency, members: list } as never);
  };

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 p-6 md:p-10">
      <section className="grid gap-3">
        <p className="text-sm font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">SplitChai Pot Copilot</p>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">
          Split group bills by talking or tapping. The copilot follows the rules your group sets.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every button here is an action the AI agent can call too, so you can type a bill, paste a receipt into the
          chat, or just say “dinner 2,400 paid by Aisha, not Ravi.” Over-cap bills wait for a person to approve.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <section className="grid content-start gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Your pots</h2>
          {isLoading ? (
            <div className="grid gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : data?.pots.length ? (
            <ul className="grid gap-2">
              {data.pots.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/pots/${p.id}`}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition hover:border-amber-500/60 hover:bg-accent"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      {p.currency}
                      <IconChevronRight className="size-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No pots yet. Make one here, or ask the agent:{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-4"
                onClick={() =>
                  sendToAgentChat({
                    message:
                      "Create a pot called Goa trip in INR for Farah, Aisha, Ravi and Meera. Bills over 3000 or more than 8000 a day need one approval. Allow food, transport, stay and activities only.",
                    submit: true,
                  })
                }
              >
                “Create a Goa trip pot for Farah, Aisha, Ravi and Meera”
              </button>
            </div>
          )}
        </section>

        <form onSubmit={submit} className="grid content-start gap-4 rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <IconPlus className="size-4" /> New pot
          </h2>
          <div className="grid gap-1.5">
            <Label htmlFor="pot-name">Name</Label>
            <Input id="pot-name" placeholder="Goa trip" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pot-members">People (comma separated)</Label>
            <Input
              id="pot-members"
              placeholder="Farah, Aisha, Ravi, Meera"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pot-currency">Currency</Label>
            <select
              id="pot-currency"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Starts with: bills over 3,000 or 8,000 a day need 1 approval, all categories allowed. Change it any time.
          </p>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create pot"}
          </Button>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              sendToAgentChat({ message: "Help me set up a pot for my group. Ask me who's in it and what rules we want.", submit: true })
            }
          >
            <IconSparkles className="size-4" /> or set it up with the agent
          </button>
        </form>
      </div>
    </main>
  );
}
