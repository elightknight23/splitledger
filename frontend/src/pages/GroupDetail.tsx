import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { GroupDetail as GroupDetailData } from "../types";

const TABS = ["Expenses", "Balances", "Activity"] as const;
type Tab = (typeof TABS)[number];

export function GroupDetail() {
  const { id } = useParams<{ id: string }>();

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Expenses");

  const [memberEmail, setMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    void loadGroup();
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
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-1 py-3 text-sm font-medium ${
                    activeTab === tab
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          {/* Placeholder content only — real tab content lands in Sprints 9 and 11. */}
          <div className="py-6 text-slate-500">
            {activeTab === "Expenses" && "Expenses go here."}
            {activeTab === "Balances" && "Balances go here."}
            {activeTab === "Activity" && "Activity goes here."}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Members</h2>
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
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isAddingMember ? "Adding…" : "Add Member"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
