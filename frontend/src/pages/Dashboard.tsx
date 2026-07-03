import { useAuth } from "../context/AuthContext";

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Welcome to Dashboard</h1>
      <p className="mt-2 text-slate-600">Logged in as {user?.name}.</p>
    </div>
  );
}
