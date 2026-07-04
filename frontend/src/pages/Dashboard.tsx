import { Loader2, PlusCircle } from "lucide-react";
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
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between border-b-2 border-primary pb-3">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface sm:text-3xl">
            Your Groups
          </h1>
          <p className="mt-2 font-body italic text-on-surface-variant">
            Logged in as {user?.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="label-caps whitespace-nowrap pb-1 text-primary hover:underline"
        >
          + New Group
        </button>
      </div>

      {loadError && (
        <p className="mt-6 border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
          {loadError}
        </p>
      )}

      {isLoading ? (
        <p className="label-caps mt-8 animate-pulse text-on-surface-variant">Inking ledger…</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => (
            <GroupCard key={group.id} group={group} index={i} />
          ))}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex min-h-44 flex-col items-center justify-center gap-2 border-2 border-dashed border-primary p-6 text-primary opacity-60 transition-opacity hover:opacity-100"
          >
            <PlusCircle className="h-9 w-9" />
            <span className="label-caps">Start New Group</span>
          </button>
        </div>
      )}

      {isModalOpen && (
        <Modal title="New Group" subtitle="Open a fresh ledger" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={(e) => void handleCreateGroup(e)}>
            {createError && (
              <p className="mb-4 border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
                {createError}
              </p>
            )}
            <label className="label-caps mb-1 block text-on-surface-variant" htmlFor="group-name">
              Group_Name:
            </label>
            <input
              id="group-name"
              type="text"
              required
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Trip to Goa"
              className="mb-6 w-full border-b-2 border-on-surface bg-transparent p-2 font-body placeholder:text-outline-variant focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="hard-shadow-sm btn-press label-caps flex w-full items-center justify-center gap-2 border-2 border-on-surface bg-primary py-3 text-on-primary disabled:opacity-60"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? "Creating…" : "Create Group"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
