import { Router } from "express";
import type { Response } from "express";
import { parseMoneyToCents } from "../lib/money";
import { requireAuth } from "../middleware/auth.middleware";
import {
  ExpenseNotFoundError,
  ExpenseValidationError,
  NotExpensePayerError,
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "../services/expense.service";
import type { ExpenseInput } from "../services/expense.service";
import { GroupNotFoundError, NotGroupMemberError } from "../services/group.service";

// mergeParams so :groupId from the mount path (/groups/:groupId/expenses)
// is visible in this router's handlers.
const router = Router({ mergeParams: true });

router.use(requireAuth);

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Express types params from each route's own path literal, so it can't see
// :groupId merged in from the mount path — hence the cast in one place.
function routeIds(params: unknown): { groupId: number | null; expenseId: number | null } {
  const p = params as { groupId?: string; expenseId?: string };
  return { groupId: parseId(p.groupId), expenseId: parseId(p.expenseId) };
}

// Returns null after responding with a 400 if the body doesn't parse.
function parseExpenseBody(body: unknown, requesterId: number, res: Response): ExpenseInput | null {
  const { description, amount, paidBy, splitType, splits } = (body ?? {}) as Record<string, unknown>;

  if (typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "description is required" });
    return null;
  }

  const amountCents = parseMoneyToCents(amount);
  if (amountCents === null) {
    res.status(400).json({ error: "amount must be a positive number with at most 2 decimal places" });
    return null;
  }

  if (paidBy !== undefined && (!Number.isInteger(paidBy) || (paidBy as number) <= 0)) {
    res.status(400).json({ error: "paidBy must be a user id" });
    return null;
  }

  if (splitType !== "equal" && splitType !== "custom") {
    res.status(400).json({ error: 'splitType must be "equal" or "custom"' });
    return null;
  }

  let split: ExpenseInput["split"];
  if (splitType === "equal") {
    split = { type: "equal" };
  } else {
    if (!Array.isArray(splits) || splits.length === 0) {
      res.status(400).json({ error: "splits array is required for a custom split" });
      return null;
    }
    const shares: { userId: number; shareCents: number }[] = [];
    for (const entry of splits) {
      const { userId, shareAmount } = (entry ?? {}) as Record<string, unknown>;
      const shareCents = parseMoneyToCents(shareAmount);
      if (!Number.isInteger(userId) || (userId as number) <= 0 || shareCents === null) {
        res.status(400).json({
          error: "each split needs a userId and a positive shareAmount with at most 2 decimal places",
        });
        return null;
      }
      shares.push({ userId: userId as number, shareCents });
    }
    split = { type: "custom", shares };
  }

  return {
    description: description.trim(),
    amountCents,
    paidBy: (paidBy as number | undefined) ?? requesterId,
    split,
  };
}

// Shared error → status mapping so each handler stays a few lines.
function respondToExpenseError(err: unknown, res: Response): void {
  if (err instanceof GroupNotFoundError || err instanceof ExpenseNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof NotGroupMemberError || err instanceof NotExpensePayerError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err instanceof ExpenseValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  throw err;
}

router.post("/", async (req, res) => {
  const { groupId } = routeIds(req.params);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const input = parseExpenseBody(req.body, req.user!.id, res);
  if (input === null) return;

  try {
    const expense = await createExpense(groupId, req.user!.id, input);
    res.status(201).json(expense);
  } catch (err) {
    respondToExpenseError(err, res);
  }
});

router.get("/", async (req, res) => {
  const { groupId } = routeIds(req.params);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  try {
    const expenses = await listExpenses(groupId, req.user!.id);
    res.json(expenses);
  } catch (err) {
    respondToExpenseError(err, res);
  }
});

router.put("/:expenseId", async (req, res) => {
  const { groupId, expenseId } = routeIds(req.params);
  if (groupId === null || expenseId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const input = parseExpenseBody(req.body, req.user!.id, res);
  if (input === null) return;

  try {
    const expense = await updateExpense(groupId, expenseId, req.user!.id, input);
    res.json(expense);
  } catch (err) {
    respondToExpenseError(err, res);
  }
});

router.delete("/:expenseId", async (req, res) => {
  const { groupId, expenseId } = routeIds(req.params);
  if (groupId === null || expenseId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    await deleteExpense(groupId, expenseId, req.user!.id);
    res.status(204).end();
  } catch (err) {
    respondToExpenseError(err, res);
  }
});

export default router;
