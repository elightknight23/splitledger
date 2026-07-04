import { CheckCircle2, Loader2, Scale, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../lib/currency";
import type { BalancesResponse, SuggestedSettlement } from "../types";
import { AVATAR_FILLS } from "./avatars";

interface BalancesTabProps {
  groupId: number;
  currency: string;
}

// Design language: sage green = money in, dusty red = money out, faded = even.
function balanceTone(amount: string): { color: string; label: string } {
  const n = Number(amount);
  if (n > 0) return { color: "text-tertiary", label: "Is Owed" };
  if (n < 0) return { color: "text-secondary", label: "Owes" };
  return { color: "text-on-surface-variant opacity-60", label: "Settled" };
}

function suggestionKey(s: SuggestedSettlement): string {
  return `${s.from.id}-${s.to.id}`;
}

export function BalancesTab({ groupId, currency }: BalancesTabProps) {
  const { user } = useAuth();
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

  // Swap in "You" so suggestions read like the design ("You pay Luna…").
  function displayName(member: { id: number; name: string }): string {
    return member.id === user?.id ? "You" : member.name;
  }

  if (isLoading) {
    return (
      <p className="label-caps animate-pulse py-6 text-on-surface-variant">Inking ledger…</p>
    );
  }

  if (!data) {
    return (
      <p className="mt-6 border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
        {error ?? "Failed to load balances"}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 py-6 xl:grid-cols-2">
      {error && (
        <p className="border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container xl:col-span-2">
          {error}
        </p>
      )}

      <div className="hard-shadow self-start border-2 border-on-surface bg-surface p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Group Standing</h2>
            <p className="mt-1 font-body text-sm italic text-on-surface-variant">
              Who's paid what and who's coasting.
            </p>
          </div>
          <Scale className="h-8 w-8 text-on-surface opacity-20" />
        </div>

        <ul className="mt-4">
          {data.balances.map((balance, i) => {
            const tone = balanceTone(balance.amount);
            return (
              <li
                key={balance.user.id}
                className="flex items-center justify-between gap-3 border-b border-dashed border-on-surface/20 py-3.5 transition-colors last:border-b-0 hover:bg-surface-container-low"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-on-surface font-body font-bold ${AVATAR_FILLS[i % AVATAR_FILLS.length]}`}
                  >
                    {balance.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-body font-bold text-on-surface">
                      {displayName(balance.user)}
                    </p>
                    <p className="label-caps mt-1 text-[10px] text-on-surface-variant opacity-60">
                      {tone.label}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 font-label text-xl font-bold ${tone.color}`}>
                  {formatMoney(Math.abs(Number(balance.amount)), currency)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="self-start border-2 border-on-surface bg-surface-container-low p-5 sm:p-6">
        <h2 className="font-headline text-xl font-bold text-on-surface">Settle Up Suggestions</h2>

        {data.suggestedSettlements.length === 0 ? (
          <div className="mt-4 flex flex-col items-center border-2 border-dashed border-on-surface/30 bg-surface p-8 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-tertiary" />
            <h3 className="font-headline text-lg font-bold">Everyone is settled!</h3>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              The ledger is clean. Go make some new shared memories (and expenses).
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.suggestedSettlements.map((suggestion) => {
              const key = suggestionKey(suggestion);
              const isSettling = settlingKey === key;
              return (
                <li key={key} className="hard-shadow-sm border-2 border-on-surface bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 shrink-0 text-tertiary" />
                    <p className="font-body text-on-surface">
                      <span className="font-bold">{displayName(suggestion.from)}</span>{" "}
                      {suggestion.from.id === user?.id ? "pay" : "pays"}{" "}
                      <span className="font-bold">{displayName(suggestion.to)}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="font-label text-2xl font-bold text-on-surface">
                      {formatMoney(suggestion.amount, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSettle(suggestion)}
                      disabled={isSettling}
                      className="label-caps flex items-center gap-2 border-2 border-on-surface bg-on-surface px-4 py-2.5 text-surface transition-colors hover:bg-primary disabled:opacity-60"
                    >
                      {isSettling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {isSettling ? "Settling…" : "Mark as Settled"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
