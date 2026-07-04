import { Coffee, HandCoins, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import { formatMoney } from "../lib/currency";
import type { Expense, GroupMember, Settlement } from "../types";

interface ActivityTabProps {
  groupId: number;
  currency: string;
  members: GroupMember[];
}

type ActivityItem =
  | { kind: "expense"; date: string; expense: Expense }
  | { kind: "settlement"; date: string; settlement: Settlement };

export function ActivityTab({ groupId, currency, members }: ActivityTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<number | "all">("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [expensesData, settlementsData] = await Promise.all([
          apiFetch<Expense[]>(`/groups/${groupId}/expenses`),
          apiFetch<Settlement[]>(`/groups/${groupId}/settlements`),
        ]);
        if (!cancelled) {
          setExpenses(expensesData);
          setSettlements(settlementsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load activity");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Expenses and settlements come from separate endpoints — merge and
  // re-sort client-side rather than asking the backend for a combined feed.
  const items = useMemo<ActivityItem[]>(() => {
    const expenseItems: ActivityItem[] = expenses.map((expense) => ({
      kind: "expense",
      date: expense.createdAt,
      expense,
    }));
    const settlementItems: ActivityItem[] = settlements.map((settlement) => ({
      kind: "settlement",
      date: settlement.settledAt,
      settlement,
    }));
    return [...expenseItems, ...settlementItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [expenses, settlements]);

  const filteredItems = items.filter((item) => {
    if (memberFilter === "all") return true;
    if (item.kind === "expense") {
      return (
        item.expense.paidBy === memberFilter ||
        item.expense.splits.some((s) => s.userId === memberFilter)
      );
    }
    return item.settlement.fromUser === memberFilter || item.settlement.toUser === memberFilter;
  });

  if (isLoading) {
    return (
      <p className="label-caps animate-pulse py-6 text-on-surface-variant">Inking ledger…</p>
    );
  }

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-on-surface pb-4">
        <div className="space-y-2">
          <span className="label-caps block text-tertiary">Filter Feed</span>
          <select
            value={memberFilter}
            onChange={(e) =>
              setMemberFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="hard-shadow-sm border-2 border-on-surface bg-surface px-4 py-2 font-body focus:border-primary focus:outline-none"
          >
            <option value="all">Everyone's entries</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>
        <span className="label-caps rotate-1 border border-on-surface bg-tertiary-fixed px-3 py-1.5 text-[10px] text-on-surface">
          {filteredItems.length} {filteredItems.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {error && (
        <p className="mt-6 border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {filteredItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center border-2 border-on-surface bg-surface-container p-12 text-center">
          <Coffee className="mb-4 h-10 w-10 text-on-surface-variant opacity-50" />
          <h3 className="font-headline text-lg font-bold">Nothing here yet</h3>
          <p className="mt-2 max-w-[240px] font-body text-sm text-on-surface-variant">
            Looks like the ledger is sleeping. Wake it up with an expense?
          </p>
        </div>
      ) : (
        <div className="relative mt-8 space-y-8">
          {/* Dashed timeline spine */}
          <div
            className="absolute bottom-0 left-[9px] top-0 border-l-2 border-dashed border-on-surface/30"
            aria-hidden="true"
          />
          {filteredItems.map((item, i) => {
            const dateLabel = new Date(item.date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            const prev = filteredItems[i - 1];
            const prevLabel = prev
              ? new Date(prev.date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : null;
            const showMarker = dateLabel !== prevLabel;

            return (
              <div key={item.kind === "expense" ? `e-${item.expense.id}` : `s-${item.settlement.id}`}>
                {showMarker && (
                  <div className="relative z-10 mb-8 flex items-center gap-4">
                    <span className="label-caps bg-on-surface px-3 py-1.5 text-surface">
                      {dateLabel}
                    </span>
                    <span className="flex-1 border-t-2 border-on-surface/10" />
                  </div>
                )}

                <div className="relative pl-9">
                  <div
                    className={`absolute left-0 top-2 z-10 h-5 w-5 rounded-full border-2 border-on-surface ${
                      item.kind === "expense" ? "bg-primary" : "bg-secondary"
                    }`}
                    aria-hidden="true"
                  />

                  {item.kind === "expense" ? (
                    <div className="border-2 border-on-surface bg-surface p-4 shadow-[4px_4px_0px_0px_#425366]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <h3 className="truncate font-body text-base font-bold text-on-surface">
                              {item.expense.description}
                            </h3>
                            <p className="mt-1 font-body text-sm text-on-surface-variant">
                              Added by{" "}
                              <span className="font-bold underline decoration-secondary">
                                {item.expense.payer.name}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-label text-lg font-bold text-on-surface">
                            {formatMoney(item.expense.amount, currency)}
                          </p>
                          <p className="label-caps mt-1 text-[10px] text-tertiary">
                            Split ×{item.expense.splits.length}
                          </p>
                        </div>
                      </div>
                      <p className="label-caps mt-3 text-[10px] text-on-surface-variant opacity-60">
                        {new Date(item.expense.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-on-surface bg-surface-container-low p-4 shadow-[4px_4px_0px_0px_#934849]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <HandCoins className="h-6 w-6 shrink-0 text-secondary" />
                          <div className="min-w-0">
                            <p className="font-body text-on-surface">
                              <span className="font-bold text-secondary">
                                {item.settlement.fromUserRef.name}
                              </span>{" "}
                              paid{" "}
                              <span className="font-bold text-primary">
                                {item.settlement.toUserRef.name}
                              </span>
                            </p>
                            <p className="label-caps mt-1 text-[10px] text-on-surface-variant opacity-60">
                              {new Date(item.settlement.settledAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              · Settled
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 font-label text-lg font-bold text-secondary">
                          {formatMoney(item.settlement.amount, currency)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
