import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import type { Expense, GroupMember, Settlement } from "../types";

interface ActivityTabProps {
  groupId: number;
  members: GroupMember[];
}

type ActivityItem =
  | { kind: "expense"; date: string; expense: Expense }
  | { kind: "settlement"; date: string; settlement: Settlement };

export function ActivityTab({ groupId, members }: ActivityTabProps) {
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
    return <p className="py-6 text-slate-500">Loading activity…</p>;
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Activity</h2>
        <select
          value={memberFilter}
          onChange={(e) =>
            setMemberFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="all">All members</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {filteredItems.length === 0 ? (
        <p className="mt-4 text-slate-500">No activity yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filteredItems.map((item) =>
            item.kind === "expense" ? (
              <li
                key={`expense-${item.expense.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{item.expense.payer.name}</span> added an expense:{" "}
                  <span className="font-medium">{item.expense.description}</span>{" "}
                  <span className="text-slate-500">
                    (${Number(item.expense.amount).toFixed(2)})
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(item.expense.createdAt).toLocaleString()}
                </p>
              </li>
            ) : (
              <li
                key={`settlement-${item.settlement.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{item.settlement.fromUserRef.name}</span> paid{" "}
                  <span className="font-medium">{item.settlement.toUserRef.name}</span>:{" "}
                  <span className="font-medium">${Number(item.settlement.amount).toFixed(2)}</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(item.settlement.settledAt).toLocaleString()}
                </p>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
