import {
  Activity,
  DoorOpen,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { ActivityTab } from "../components/ActivityTab";
import { AddExpenseModal } from "../components/AddExpenseModal";
import { AVATAR_FILLS } from "../components/avatars";
import { BalancesTab } from "../components/BalancesTab";
import { useAuth } from "../context/AuthContext";
import type { Expense, GroupDetail as GroupDetailData } from "../types";

const TABS = [
  { name: "Expenses", icon: Receipt },
  { name: "Balances", icon: Scale },
  { name: "Activity", icon: Activity },
] as const;
type Tab = (typeof TABS)[number]["name"];

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Expenses");

  const [memberEmail, setMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);

  // Shared by the leave and delete actions — both navigate away on success.
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [isDangerActing, setIsDangerActing] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  // undefined = closed, null = create mode, an Expense = edit mode.
  const [expenseModal, setExpenseModal] = useState<Expense | null | undefined>(undefined);

  async function loadGroup() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<GroupDetailData>(`/groups/${id}`);
      setGroup(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load group");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadExpenses() {
    setExpensesError(null);
    try {
      const data = await apiFetch<Expense[]>(`/groups/${id}/expenses`);
      setExpenses(data);
    } catch (err) {
      setExpensesError(err instanceof ApiError ? err.message : "Failed to load expenses");
    }
  }

  useEffect(() => {
    void loadGroup();
    void loadExpenses();
  }, [id]);

  async function handleInviteMember(e: FormEvent) {
    e.preventDefault();
    setAddMemberError(null);
    setAddMemberSuccess(null);
    setIsAddingMember(true);
    try {
      await apiFetch(`/groups/${id}/invites`, {
        method: "POST",
        body: { email: memberEmail },
      });
      // No group refresh: they only appear in the member list once they accept.
      setAddMemberSuccess(`Invite sent to ${memberEmail}`);
      setMemberEmail("");
    } catch (err) {
      setAddMemberError(err instanceof ApiError ? err.message : "Failed to send invite");
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleLeaveGroup() {
    if (!window.confirm("Leave this group?")) {
      return;
    }
    setDangerError(null);
    setIsDangerActing(true);
    try {
      await apiFetch(`/groups/${id}/leave`, { method: "POST" });
      navigate("/dashboard");
    } catch (err) {
      setDangerError(err instanceof ApiError ? err.message : "Failed to leave group");
      setIsDangerActing(false);
    }
  }

  async function handleDeleteGroup() {
    if (
      !window.confirm(
        "Delete this group? All of its expenses and settlements will be permanently deleted for every member. This cannot be undone."
      )
    ) {
      return;
    }
    setDangerError(null);
    setIsDangerActing(true);
    try {
      await apiFetch(`/groups/${id}`, { method: "DELETE" });
      navigate("/dashboard");
    } catch (err) {
      setDangerError(err instanceof ApiError ? err.message : "Failed to delete group");
      setIsDangerActing(false);
    }
  }

  async function handleDeleteExpense(expenseId: number) {
    if (!window.confirm("Delete this expense? This cannot be undone.")) {
      return;
    }
    setExpensesError(null);
    try {
      await apiFetch(`/groups/${id}/expenses/${expenseId}`, { method: "DELETE" });
      await loadExpenses();
    } catch (err) {
      setExpensesError(err instanceof ApiError ? err.message : "Failed to delete expense");
    }
  }

  if (isLoading) {
    return <p className="label-caps animate-pulse text-on-surface-variant">Inking ledger…</p>;
  }

  if (loadError || !group) {
    return (
      <p className="border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
        {loadError ?? "Group not found"}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-headline text-2xl font-bold text-on-surface sm:text-3xl">
          {group.name}
        </h1>
        <span className="label-caps -rotate-1 border border-on-surface bg-tertiary-fixed px-2 py-1 text-[10px] text-on-surface">
          Est. {new Date(group.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="border-b-2 border-on-surface/10">
            <nav className="flex gap-6 sm:gap-8">
              {TABS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveTab(name)}
                  className={`label-caps flex items-center gap-1.5 px-1 pb-3 pt-2 ${
                    activeTab === name
                      ? "-mb-0.5 border-b-4 border-primary text-primary"
                      : "border-b-4 border-transparent text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {name}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === "Expenses" && (
            <div className="py-6">
              <div className="hard-shadow border-2 border-on-surface bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-headline text-xl font-bold text-on-surface">
                      Expense Log
                    </h2>
                    <p className="label-caps mt-1.5 text-[10px] text-on-surface-variant opacity-70">
                      {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpenseModal(null)}
                    className="hard-shadow-sm btn-press label-caps flex items-center gap-2 border-2 border-on-surface bg-primary px-4 py-2.5 text-on-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Add Expense
                  </button>
                </div>

                {expensesError && (
                  <p className="mt-4 border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
                    {expensesError}
                  </p>
                )}

                {expenses.length === 0 ? (
                  <p className="mt-6 border-2 border-dashed border-on-surface/30 p-8 text-center font-body italic text-on-surface-variant">
                    The ledger is empty. Add the first entry.
                  </p>
                ) : (
                  <ul className="mt-4 border-t-2 border-on-surface">
                    {expenses.map((expense) => (
                      <li
                        key={expense.id}
                        className="group flex items-center justify-between gap-4 border-b border-dashed border-on-surface/20 py-3 transition-colors hover:bg-surface-container-low"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-body font-bold text-on-surface">
                            {expense.description}
                          </p>
                          <p className="label-caps mt-1.5 text-[10px] text-on-surface-variant opacity-70">
                            Paid by {expense.payer.name} ·{" "}
                            {new Date(expense.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-label text-base font-bold text-on-surface">
                            ${Number(expense.amount).toFixed(2)}
                          </span>
                          {expense.paidBy === user?.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => setExpenseModal(expense)}
                                aria-label="Edit expense"
                                className="text-on-surface-variant hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteExpense(expense.id)}
                                aria-label="Delete expense"
                                className="text-on-surface-variant hover:text-error"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === "Balances" && <BalancesTab groupId={group.id} />}
          {activeTab === "Activity" && <ActivityTab groupId={group.id} members={group.members} />}
        </div>

        <aside className="self-start border-2 border-on-surface bg-surface-container-low p-5 lg:hard-shadow">
          <h2 className="label-caps flex items-center gap-2 text-on-surface-variant">
            <Users className="h-4 w-4" />
            Members
          </h2>
          <ul className="mt-4 space-y-3">
            {group.members.map((member, i) => (
              <li key={member.id} className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-on-surface font-body font-bold ${AVATAR_FILLS[i % AVATAR_FILLS.length]}`}
                >
                  {member.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-body font-bold text-on-surface">
                    {member.user.name}
                  </p>
                  <p className="truncate font-body text-xs text-on-surface-variant">
                    {member.user.email}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => void handleInviteMember(e)}
            className="mt-6 border-2 border-dashed border-outline bg-surface-container-lowest/50 p-4"
          >
            <label className="label-caps mb-3 block text-on-surface-variant" htmlFor="member-email">
              Invite_Member:
            </label>
            {addMemberError && (
              <p className="mb-3 border-2 border-error bg-error-container px-2 py-1.5 text-xs text-on-error-container">
                {addMemberError}
              </p>
            )}
            {addMemberSuccess && (
              <p className="label-caps mb-3 inline-block -rotate-1 border border-on-surface bg-tertiary-fixed px-2 py-1.5 text-[10px] text-on-surface">
                {addMemberSuccess}
              </p>
            )}
            <input
              id="member-email"
              type="email"
              required
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="email@address.com"
              className="mb-3 w-full border-b-2 border-on-surface bg-transparent p-1 font-body italic placeholder:text-outline-variant focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={isAddingMember}
              className="label-caps flex w-full items-center justify-center gap-2 bg-on-surface py-2.5 text-surface transition-colors hover:bg-primary disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {isAddingMember ? "Sending…" : "Send Invite"}
            </button>
          </form>

          <div className="mt-6 border-t-2 border-dashed border-on-surface/20 pt-4">
            {dangerError && (
              <p className="mb-3 border-2 border-error bg-error-container px-2 py-1.5 text-xs text-on-error-container">
                {dangerError}
              </p>
            )}
            {user?.id === group.createdBy ? (
              <button
                type="button"
                disabled={isDangerActing}
                onClick={() => void handleDeleteGroup()}
                className="label-caps flex w-full items-center justify-center gap-2 border-2 border-error py-2.5 text-error transition-colors hover:bg-error hover:text-surface disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {isDangerActing ? "Deleting…" : "Delete Group"}
              </button>
            ) : (
              <button
                type="button"
                disabled={isDangerActing}
                onClick={() => void handleLeaveGroup()}
                className="label-caps flex w-full items-center justify-center gap-2 border-2 border-error py-2.5 text-error transition-colors hover:bg-error hover:text-surface disabled:opacity-60"
              >
                <DoorOpen className="h-4 w-4" />
                {isDangerActing ? "Leaving…" : "Leave Group"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {expenseModal !== undefined && (
        <AddExpenseModal
          group={group}
          expense={expenseModal ?? undefined}
          onClose={() => setExpenseModal(undefined)}
          onSaved={() => void loadExpenses()}
        />
      )}
    </div>
  );
}
