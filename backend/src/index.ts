import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.routes";
import expenseRoutes from "./routes/expense.routes";
import groupRoutes from "./routes/group.routes";
import inviteRoutes from "./routes/invite.routes";
import settlementRoutes from "./routes/settlement.routes";

const app = express();

// Comma-separated allowlist; trailing slashes stripped because the browser's
// Origin header never includes one, and cors() compares by string equality.
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""));

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/groups", groupRoutes);
app.use("/groups/:groupId/expenses", expenseRoutes);
app.use("/groups/:groupId", settlementRoutes);
app.use("/invites", inviteRoutes);

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
