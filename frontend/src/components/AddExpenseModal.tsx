import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { currencySymbol } from "../lib/currency";
import type { Expense, GroupDetail as GroupDetailData } from "../types";
import { AVATAR_FILLS } from "./avatars";
import { Modal } from "./Modal";

// UI-level split mode. Only "equal" and "amount" map onto a distinct wire
// splitType — "percent" and "shares" are Splitwise-style conveniences that
// get converted to exact dollar amounts client-side and submitted as the
// backend's existing "custom" split, so no API contract changes were needed.
type UiSplitType = "equal" | "amount" | "percent" | "shares";

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

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Shared remainder-distribution logic: floor each member's proportional
// share, then hand the leftover cents one each to the first members by id
// order (same deterministic tie-break backend/src/services/expense.service.ts
// uses for equal splits) so the total always sums to exactly totalCents.
function distributeProportional(
  entries: { userId: number; weight: number }[],
  totalCents: number
): Map<number, number> {
  const sorted = [...entries].sort((a, b) => a.userId - b.userId);
  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  const base = sorted.map((e) => Math.floor((totalCents * e.weight) / totalWeight));
  const remainder = totalCents - base.reduce((sum, c) => sum + c, 0);
  const result = new Map<number, number>();
  sorted.forEach((e, i) => {
    result.set(e.userId, base[i] + (i < remainder ? 1 : 0));
  });
  return result;
}

function buildEqualSharesCents(memberIds: number[], totalCents: number): Map<number, number> {
  return distributeProportional(memberIds.map((userId) => ({ userId, weight: 1 })), totalCents);
}

interface AddExpenseModalProps {
  group: GroupDetailData;
  expense?: Expense;
  onClose: () => void;
  onSaved: () => void;
}

const SPLIT_OPTIONS: { type: UiSplitType; label: string }[] = [
  { type: "equal", label: "Equal" },
  { type: "amount", label: "Amount" },
  { type: "percent", label: "Percent" },
  { type: "shares", label: "Shares" },
];

const SPLIT_INPUT_CLASSES =
  "border border-on-surface bg-surface-container-lowest px-2 py-1 text-right font-label text-sm focus:border-primary focus:outline-none";

export function AddExpenseModal({ group, expense, onClose, onSaved }: AddExpenseModalProps) {
  const { user } = useAuth();
  const isEditMode = expense !== undefined;
  const symbol = currencySymbol(group.currency);

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amountStr, setAmountStr] = useState(expense?.amount ?? "");
  const [payerId, setPayerId] = useState<number>(expense?.paidBy ?? user!.id);
  // Editing always starts in "Amount" mode pre-filled with the expense's
  // actual current shares, regardless of how it was originally split — that's
  // the true current state; switching modes recomputes from scratch.
  const [uiSplitType, setUiSplitType] = useState<UiSplitType>(isEditMode ? "amount" : "equal");

  const [amountShares, setAmountShares] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const split of expense?.splits ?? []) {
      initial[split.userId] = split.shareAmount;
    }
    return initial;
  });
  const [percentShares, setPercentShares] = useState<Record<number, string>>({});
  const [shareUnits, setShareUnits] = useState<Record<number, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberIds = group.members.map((m) => m.userId);
  const totalCents = toCents(amountStr);
  const equalPreview = totalCents !== null ? buildEqualSharesCents(memberIds, totalCents) : null;

  const amountEntries = group.members
    .map((m) => ({ userId: m.userId, cents: toCents(amountShares[m.userId] ?? "") }))
    .filter((entry): entry is { userId: number; cents: number } => entry.cents !== null);
  const amountSumCents = amountEntries.reduce((sum, entry) => sum + entry.cents, 0);
  const amountMismatch =
    uiSplitType === "amount" && totalCents !== null && amountSumCents !== totalCents;

  const percentEntries = group.members
    .map((m) => ({ userId: m.userId, percent: parsePositiveNumber(percentShares[m.userId] ?? "") }))
    .filter((entry): entry is { userId: number; percent: number } => entry.percent !== null);
  const percentSum = Math.round(percentEntries.reduce((sum, e) => sum + e.percent, 0) * 100) / 100;
  const percentMismatch = uiSplitType === "percent" && percentSum !== 100;
  const percentPreview =
    uiSplitType === "percent" && totalCents !== null
      ? distributeProportional(
          percentEntries.map((e) => ({ userId: e.userId, weight: e.percent })),
          totalCents
        )
      : null;

  const shareEntries = group.members
    .map((m) => ({ userId: m.userId, units: parsePositiveNumber(shareUnits[m.userId] ?? "") }))
    .filter((entry): entry is { userId: number; units: number } => entry.units !== null);
  const sharesPreview =
    uiSplitType === "shares" && totalCents !== null && shareEntries.length > 0
      ? distributeProportional(
          shareEntries.map((e) => ({ userId: e.userId, weight: e.units })),
          totalCents
        )
      : null;

  const submitDisabled =
    isSubmitting ||
    (uiSplitType === "amount" && amountMismatch) ||
    (uiSplitType === "percent" && percentMismatch);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (totalCents === null) {
      setError("Enter a valid total amount greater than 0");
      return;
    }

    let body: Record<string, unknown>;
    if (uiSplitType === "equal") {
      body = { description, amount: amountStr, paidBy: payerId, splitType: "equal" };
    } else {
      let sharesCents: Map<number, number>;

      if (uiSplitType === "amount") {
        // Guardrail: block submission entirely if the entered shares don't
        // sum to the total, even though the button is also disabled for
        // this — pressing Enter in a text input submits the form regardless
        // of the submit button's disabled state, so this check is the real
        // guardrail, not the disabled attribute.
        if (amountEntries.length === 0) {
          setError("Enter at least one custom split amount");
          return;
        }
        if (amountSumCents !== totalCents) {
          setError(
            `Splits sum to ${symbol}${centsToDisplay(amountSumCents)} but the total is ${symbol}${centsToDisplay(totalCents)}`
          );
          return;
        }
        sharesCents = new Map(amountEntries.map((entry) => [entry.userId, entry.cents]));
      } else if (uiSplitType === "percent") {
        if (percentEntries.length === 0) {
          setError("Enter at least one percentage");
          return;
        }
        if (percentSum !== 100) {
          setError(`Percentages sum to ${percentSum}% but must equal 100%`);
          return;
        }
        sharesCents = distributeProportional(
          percentEntries.map((entry) => ({ userId: entry.userId, weight: entry.percent })),
          totalCents
        );
      } else {
        if (shareEntries.length === 0) {
          setError("Enter at least one share count");
          return;
        }
        sharesCents = distributeProportional(
          shareEntries.map((entry) => ({ userId: entry.userId, weight: entry.units })),
          totalCents
        );
      }

      body = {
        description,
        amount: amountStr,
        paidBy: payerId,
        splitType: "custom",
        splits: [...sharesCents.entries()].map(([userId, cents]) => ({
          userId,
          shareAmount: centsToDisplay(cents),
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
    <Modal
      title={isEditMode ? "Edit Entry" : "Add New Entry"}
      subtitle={`${group.name} ledger`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
        {error && (
          <p className="border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              className="label-caps block text-on-surface-variant"
              htmlFor="expense-description"
            >
              Description
            </label>
            <input
              id="expense-description"
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Internet Bill"
              className="w-full border-b-2 border-on-surface bg-transparent py-2 font-body text-lg placeholder:text-outline-variant focus:border-primary focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="label-caps block text-on-surface-variant" htmlFor="expense-amount">
              Total Amount
            </label>
            <div className="flex items-center border-b-2 border-on-surface">
              <span className="mr-2 font-body text-lg">{symbol}</span>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent py-2 font-label text-lg placeholder:text-outline-variant focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="label-caps block text-on-surface-variant" htmlFor="expense-payer">
            Paid By
          </label>
          <select
            id="expense-payer"
            value={payerId}
            onChange={(e) => setPayerId(Number(e.target.value))}
            className="w-full border-2 border-on-surface bg-surface-container-low px-3 py-2 font-body focus:border-primary focus:outline-none"
          >
            {group.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <span className="label-caps block text-on-surface-variant">Split Method</span>
          <div className="grid grid-cols-4 border-2 border-on-surface">
            {SPLIT_OPTIONS.map(({ type, label }, i) => (
              <button
                key={type}
                type="button"
                onClick={() => setUiSplitType(type)}
                className={`label-caps py-2.5 text-[11px] transition-colors ${
                  i > 0 ? "border-l-2 border-on-surface" : ""
                } ${
                  uiSplitType === type
                    ? "bg-on-surface text-surface"
                    : "text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1 border border-outline-variant bg-surface-container-low p-4">
          {group.members.map((m, i) => (
            <div
              key={m.userId}
              className="flex items-center justify-between gap-3 border-b border-on-surface/10 py-2 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center border border-on-surface font-body text-xs font-bold ${AVATAR_FILLS[i % AVATAR_FILLS.length]}`}
                >
                  {m.user.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate font-body font-bold">{m.user.name}</span>
              </div>

              {uiSplitType === "equal" && (
                <span className="font-label text-sm text-on-surface-variant">
                  {equalPreview ? `${symbol}${centsToDisplay(equalPreview.get(m.userId) ?? 0)}` : "—"}
                </span>
              )}

              {uiSplitType === "amount" && (
                <div className="flex items-center gap-2">
                  <span className="font-body text-xs text-on-surface-variant">{symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amountShares[m.userId] ?? ""}
                    onChange={(e) =>
                      setAmountShares((prev) => ({ ...prev, [m.userId]: e.target.value }))
                    }
                    className={`w-24 ${SPLIT_INPUT_CLASSES}`}
                  />
                </div>
              )}

              {uiSplitType === "percent" && (
                <div className="flex items-center gap-2">
                  {percentPreview && (
                    <span className="font-label text-xs text-on-surface-variant">
                      {symbol}
                      {centsToDisplay(percentPreview.get(m.userId) ?? 0)}
                    </span>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={percentShares[m.userId] ?? ""}
                    onChange={(e) =>
                      setPercentShares((prev) => ({ ...prev, [m.userId]: e.target.value }))
                    }
                    className={`w-20 ${SPLIT_INPUT_CLASSES}`}
                  />
                  <span className="font-body text-xs text-on-surface-variant">%</span>
                </div>
              )}

              {uiSplitType === "shares" && (
                <div className="flex items-center gap-2">
                  {sharesPreview && (
                    <span className="font-label text-xs text-on-surface-variant">
                      {symbol}
                      {centsToDisplay(sharesPreview.get(m.userId) ?? 0)}
                    </span>
                  )}
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={shareUnits[m.userId] ?? ""}
                    onChange={(e) =>
                      setShareUnits((prev) => ({ ...prev, [m.userId]: e.target.value }))
                    }
                    className={`w-16 ${SPLIT_INPUT_CLASSES}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {uiSplitType === "amount" && amountMismatch && (
          <div className="flex items-start gap-3 border-2 border-secondary bg-secondary-container/50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-secondary" />
            <div>
              <p className="label-caps text-on-secondary-container">Split Mismatch</p>
              <p className="mt-1.5 font-body text-xs text-on-secondary-container">
                Splits sum to {symbol}
                {centsToDisplay(amountSumCents)} but the total is {symbol}
                {centsToDisplay(totalCents!)}.
              </p>
            </div>
          </div>
        )}
        {uiSplitType === "percent" && percentMismatch && (
          <div className="flex items-start gap-3 border-2 border-secondary bg-secondary-container/50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-secondary" />
            <div>
              <p className="label-caps text-on-secondary-container">Split Mismatch</p>
              <p className="mt-1.5 font-body text-xs text-on-secondary-container">
                Percentages sum to {percentSum}% but must equal 100%.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="label-caps flex-1 border-2 border-on-surface py-3.5 transition-colors hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="hard-shadow-sm btn-press label-caps flex flex-1 items-center justify-center gap-2 border-2 border-on-surface bg-primary py-3.5 text-on-primary disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving…" : isEditMode ? "Update Entry" : "Publish to Ledger"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
