import { Activity, Pencil, Plus, Receipt, Scale, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { ActivityTab } from "../components/ActivityTab";
import { AddExpenseModal } from "../components/AddExpenseModal";
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
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Expenses");

  const [memberEmail, setMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);

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

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    setAddMemberError(null);
    setAddMemberSuccess(null);
    setIsAddingMember(true);
    try {
      await apiFetch(`/groups/${id}/members`, {
        method: "POST",
        body: { email: memberEmail },
      });
      setAddMemberSuccess(`Added ${memberEmail}`);
      setMemberEmail("");
      await loadGroup();
    } catch (err) {
      setAddMemberError(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setIsAddingMember(false);
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
    return <p className="text-slate-500">Loading group…</p>;
  }

  if (loadError || !group) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {loadError ?? "Group not found"}
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">{group.name}</h1>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="border-b border-slate-200">
            <nav className="flex gap-6">
              {TABS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveTab(name)}
                  className={`flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium ${
                    activeTab === name
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Expenses</h2>
                <button
                  type="button"
                  onClick={() => setExpenseModal(null)}
                  className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Add Expense
                </button>
              </div>

              {expensesError && (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {expensesError}
                </p>
              )}

              {expenses.length === 0 ? (
                <p className="mt-4 text-slate-500">No expenses yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {expenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{expense.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Paid by {expense.payer.name} ·{" "}
                          {new Date(expense.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-800">
                          ${Number(expense.amount).toFixed(2)}
                        </span>
                        {expense.paidBy === user?.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpenseModal(expense)}
                              aria-label="Edit expense"
                              className="text-slate-500 hover:text-slate-900"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteExpense(expense.id)}
                              aria-label="Delete expense"
                              className="text-red-500 hover:text-red-700"
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
          )}

          {activeTab === "Balances" && <BalancesTab groupId={group.id} />}
          {activeTab === "Activity" && (
            <ActivityTab groupId={group.id} members={group.members} />
          )}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4" />
            Members
          </h2>
          <ul className="mt-3 space-y-2">
            {group.members.map((member) => (
              <li key={member.id} className="text-sm text-slate-600">
                {member.user.name}{" "}
                <span className="text-slate-400">({member.user.email})</span>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => void handleAddMember(e)}
            className="mt-5 border-t border-slate-200 pt-5"
          >
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="member-email">
              Add member by email
            </label>
            {addMemberError && (
              <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {addMemberError}
              </p>
            )}
            {addMemberSuccess && (
              <p className="mb-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
                {addMemberSuccess}
              </p>
            )}
            <input
              id="member-email"
              type="email"
              required
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isAddingMember}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {isAddingMember ? "Adding…" : "Add Member"}
            </button>
          </form>
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
