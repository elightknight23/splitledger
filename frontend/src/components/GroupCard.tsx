import { ArrowRight, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Group } from "../types";

// index drives the alternating "sticker" tilt on hover so a grid of cards
// doesn't all lean the same way.
export function GroupCard({ group, index }: { group: Group; index: number }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/groups/${group.id}`)}
      className={`hard-shadow border-2 border-on-surface bg-surface p-5 text-left transition-transform cursor-pointer ${
        index % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center border-2 border-on-surface bg-primary-fixed">
        <Users className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">{group.name}</h3>
      <p className="label-caps mt-2 text-on-surface-variant">
        Created {new Date(group.createdAt).toLocaleDateString()} · {group.currency}
      </p>
      <div className="mt-4 flex items-center justify-between text-primary">
        <span className="label-caps">Open Ledger</span>
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
}
