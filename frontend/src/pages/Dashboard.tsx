import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api/client";
import { GroupCard } from "../components/GroupCard";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import type { Group } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadGroups() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<Group[]>("/groups");
      setGroups(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
  }, []);

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      await apiFetch<Group>("/groups", { method: "POST", body: { name: newGroupName } });
      setNewGroupName("");
      setIsModalOpen(false);
      await loadGroups();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Your Groups</h1>
          <p className="mt-1 text-slate-600">Logged in as {user?.name}.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New Group
        </button>
      </div>

      {loadError && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
      )}

      {isLoading ? (
        <p className="mt-6 text-slate-500">Loading groups…</p>
      ) : groups.length === 0 ? (
        <p className="mt-6 text-slate-500">
          You're not in any groups yet. Create one to get started.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {isModalOpen && (
        <Modal title="New Group" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={(e) => void handleCreateGroup(e)}>
            {createError && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </p>
            )}
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="group-name">
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              required
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="mb-6 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isCreating ? "Creating…" : "Create Group"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
