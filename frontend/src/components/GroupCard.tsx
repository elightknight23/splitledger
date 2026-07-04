import { useNavigate } from "react-router-dom";
import type { Group } from "../types";

export function GroupCard({ group }: { group: Group }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/groups/${group.id}`)}
      className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <h3 className="text-base font-semibold text-slate-800">{group.name}</h3>
      <p className="mt-1 text-sm text-slate-500">
        Created {new Date(group.createdAt).toLocaleDateString()}
      </p>
    </button>
  );
}
