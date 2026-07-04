import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import type { BalancesResponse, SuggestedSettlement } from "../types";

interface BalancesTabProps {
  groupId: number;
}

function balanceColor(amount: string): string {
  const n = Number(amount);
  if (n > 0) return "text-green-600";
  if (n < 0) return "text-red-600";
  return "text-slate-500";
}

// centsToDecimalString on the backend puts the sign before the digits
// ("-50.00"), so a naive `$${amount}` reads as "$-50.00" — pull the sign out
// front instead.
function formatSignedAmount(amount: string): string {
  const n = Number(amount);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function suggestionKey(s: SuggestedSettlement): string {
  return `${s.from.id}-${s.to.id}`;
}

export function BalancesTab({ groupId }: BalancesTabProps) {
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  async function loadBalances() {
    setError(null);
    try {
      const result = await apiFetch<BalancesResponse>(`/groups/${groupId}/balances`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load balances");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBalances();
  }, [groupId]);

  async function handleSettle(suggestion: SuggestedSettlement) {
    setError(null);
    setSettlingKey(suggestionKey(suggestion));
    try {
      await apiFetch(`/groups/${groupId}/settlements`, {
        method: "POST",
        body: {
          fromUser: suggestion.from.id,
          toUser: suggestion.to.id,
          amount: suggestion.amount,
        },
      });
      await loadBalances();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record settlement");
    } finally {
      setSettlingKey(null);
    }
  }

  if (isLoading) {
    return <p className="py-6 text-slate-500">Loading balances…</p>;
  }

  if (!data) {
    return (
      <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error ?? "Failed to load balances"}
      </p>
    );
  }

  return (
    <div className="py-6">
      <h2 className="text-sm font-semibold text-slate-800">Balances</h2>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <ul className="mt-4 space-y-2">
        {data.balances.map((balance) => (
          <li
            key={balance.user.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <span className="text-sm font-medium text-slate-800">{balance.user.name}</span>
            <span className={`text-sm font-semibold ${balanceColor(balance.amount)}`}>
              {formatSignedAmount(balance.amount)}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-sm font-semibold text-slate-800">Settle Up</h2>
      {data.suggestedSettlements.length === 0 ? (
        <p className="mt-4 text-slate-500">Everyone is settled up.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.suggestedSettlements.map((suggestion) => {
            const key = suggestionKey(suggestion);
            const isSettling = settlingKey === key;
            return (
              <li
                key={key}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
              >
                <span className="text-sm text-slate-700">
                  <span className="font-medium">{suggestion.from.name}</span> owes{" "}
                  <span className="font-medium">{suggestion.to.name}</span>{" "}
                  <span className="font-semibold">${Number(suggestion.amount).toFixed(2)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleSettle(suggestion)}
                  disabled={isSettling}
                  className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSettling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSettling ? "Settling…" : "Mark as Settled"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
