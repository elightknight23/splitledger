import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Expense, GroupDetail as GroupDetailData } from "../types";
import { Modal } from "./Modal";

type SplitType = "equal" | "custom";

// Parses a form input string to integer cents, or null if it isn't a
// positive number — mirrors backend/src/lib/money.ts's cents-based approach
// so "does this sum match the total" never relies on float equality.
function toCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Mirrors buildEqualShares in backend/src/services/expense.service.ts purely
// so the "Equal" preview shows the same per-member amounts the server will
// actually save — the server recomputes this independently, this is display only.
function buildEqualSharesCents(memberIds: number[], totalCents: number): Map<number, number> {
  const sorted = [...memberIds].sort((a, b) => a - b);
  const base = Math.floor(totalCents / sorted.length);
  const remainder = totalCents - base * sorted.length;
  return new Map(sorted.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
}

interface AddExpenseModalProps {
  group: GroupDetailData;
  expense?: Expense;
  onClose: () => void;
  onSaved: () => void;
}

export function AddExpenseModal({ group, expense, onClose, onSaved }: AddExpenseModalProps) {
  const { user } = useAuth();
  const isEditMode = expense !== undefined;

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amountStr, setAmountStr] = useState(expense?.amount ?? "");
  const [payerId, setPayerId] = useState<number>(expense?.paidBy ?? user!.id);
  // Editing always starts in "custom" mode pre-filled with the expense's
  // actual current shares, regardless of how it was originally split — that's
  // the true current state; switching to "Equal" recomputes from scratch.
  const [splitType, setSplitType] = useState<SplitType>(isEditMode ? "custom" : "equal");
  const [customShares, setCustomShares] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const split of expense?.splits ?? []) {
      initial[split.userId] = split.shareAmount;
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberIds = group.members.map((m) => m.userId);
  const totalCents = toCents(amountStr);
  const equalPreview = totalCents !== null ? buildEqualSharesCents(memberIds, totalCents) : null;

  const customEntries = group.members
    .map((m) => ({ userId: m.userId, cents: toCents(customShares[m.userId] ?? "") }))
    .filter((entry): entry is { userId: number; cents: number } => entry.cents !== null);
  const customSumCents = customEntries.reduce((sum, entry) => sum + entry.cents, 0);
  const customMismatch =
    splitType === "custom" && totalCents !== null && customSumCents !== totalCents;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (totalCents === null) {
      setError("Enter a valid total amount greater than 0");
      return;
    }

    let body: Record<string, unknown>;
    if (splitType === "equal") {
      body = { description, amount: amountStr, paidBy: payerId, splitType: "equal" };
    } else {
      if (customEntries.length === 0) {
        setError("Enter at least one custom split amount");
        return;
      }
      // Guardrail: block submission entirely if the entered shares don't sum
      // to the total, even though the button is also disabled for this —
      // pressing Enter in a text input submits the form regardless of the
      // submit button's disabled state, so this check is the real guardrail.
      if (customSumCents !== totalCents) {
        setError(
          `Splits sum to $${centsToDisplay(customSumCents)} but the total is $${centsToDisplay(totalCents)}`
        );
        return;
      }
      body = {
        description,
        amount: amountStr,
        paidBy: payerId,
        splitType: "custom",
        splits: customEntries.map((entry) => ({
          userId: entry.userId,
          shareAmount: centsToDisplay(entry.cents),
        })),
      };
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await apiFetch(`/groups/${group.id}/expenses/${expense.id}`, { method: "PUT", body });
      } else {
        await apiFetch(`/groups/${group.id}/expenses`, { method: "POST", body });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save expense");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEditMode ? "Edit Expense" : "Add Expense"} onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)}>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="expense-description">
          Description
        </label>
        <input
          id="expense-description"
          type="text"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="expense-amount">
          Total Amount
        </label>
        <input
          id="expense-amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="expense-payer">
          Paid by
        </label>
        <select
          id="expense-payer"
          value={payerId}
          onChange={(e) => setPayerId(Number(e.target.value))}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          {group.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>

        <span className="mb-1 block text-sm font-medium text-slate-700">Split</span>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSplitType("equal")}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
              splitType === "equal"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Equal
          </button>
          <button
            type="button"
            onClick={() => setSplitType("custom")}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
              splitType === "custom"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Custom
          </button>
        </div>

        <div className="mb-4 space-y-2 rounded-md border border-slate-200 p-3">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600">{m.user.name}</span>
              {splitType === "equal" ? (
                <input
                  type="text"
                  disabled
                  value={equalPreview ? `$${centsToDisplay(equalPreview.get(m.userId) ?? 0)}` : "—"}
                  className="w-28 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm text-slate-500"
                />
              ) : (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={customShares[m.userId] ?? ""}
                  onChange={(e) =>
                    setCustomShares((prev) => ({ ...prev, [m.userId]: e.target.value }))
                  }
                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-slate-500 focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>

        {customMismatch && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Splits sum to ${centsToDisplay(customSumCents)} but the total is $
            {centsToDisplay(totalCents!)}.
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || customMismatch}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : isEditMode ? "Save Changes" : "Add Expense"}
        </button>
      </form>
    </Modal>
  );
}
