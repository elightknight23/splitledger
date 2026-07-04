import { Check, Loader2, Mail, PlusCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api/client";
import { GroupCard } from "../components/GroupCard";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import type { Group, GroupInvite } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  // Invite id currently being accepted/declined, so only that row's buttons lock.
  const [actingInviteId, setActingInviteId] = useState<number | null>(null);

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

  async function loadInvites() {
    try {
      const data = await apiFetch<GroupInvite[]>("/invites");
      setInvites(data);
    } catch {
      // Non-critical panel — a failed invite fetch shouldn't block the dashboard.
      setInvites([]);
    }
  }

  useEffect(() => {
    void loadGroups();
    void loadInvites();
  }, []);

  async function handleInviteAction(invite: GroupInvite, action: "accept" | "decline") {
    setInviteError(null);
    setActingInviteId(invite.id);
    try {
      await apiFetch(`/invites/${invite.id}/${action}`, { method: "POST" });
      await loadInvites();
      if (action === "accept") {
        await loadGroups();
      }
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : `Failed to ${action} invite`);
    } finally {
      setActingInviteId(null);
    }
  }

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

      {invites.length > 0 && (
        <section className="mt-8">
          <h2 className="label-caps flex items-center gap-2 text-on-surface-variant">
            <Mail className="h-4 w-4" />
            Pending Invites
          </h2>
          {inviteError && (
            <p className="mt-3 border-2 border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
              {inviteError}
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {invites.map((invite) => {
              const isActing = actingInviteId === invite.id;
              return (
                <li
                  key={invite.id}
                  className="hard-shadow-sm flex flex-wrap items-center justify-between gap-3 border-2 border-on-surface bg-secondary-fixed p-4"
                >
                  <p className="font-body text-on-surface">
                    <span className="font-bold">{invite.invitedBy.name}</span> invited you to{" "}
                    <span className="font-bold">{invite.group.name}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => void handleInviteAction(invite, "accept")}
                      className="label-caps flex items-center gap-1.5 border-2 border-on-surface bg-tertiary px-3 py-2 text-on-tertiary transition-colors hover:bg-tertiary-container disabled:opacity-60"
                    >
                      {isActing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => void handleInviteAction(invite, "decline")}
                      className="label-caps flex items-center gap-1.5 border-2 border-on-surface bg-surface px-3 py-2 text-on-surface transition-colors hover:bg-error-container disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
