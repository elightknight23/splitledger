import { Router } from "express";
import type { Response } from "express";
import { parseMoneyToCents } from "../lib/money";
import { requireAuth } from "../middleware/auth.middleware";
import { GroupNotFoundError, NotGroupMemberError } from "../services/group.service";
import {
  SettlementValidationError,
  createSettlement,
  getGroupBalances,
  listSettlements,
} from "../services/settlement.service";
import type { SettlementInput } from "../services/settlement.service";

// mergeParams so :groupId from the mount path (/groups/:groupId) is visible here.
const router = Router({ mergeParams: true });

router.use(requireAuth);

function parseGroupId(params: unknown): number | null {
  const id = Number((params as { groupId?: string }).groupId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function respondToSettlementError(err: unknown, res: Response): void {
  if (err instanceof GroupNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof NotGroupMemberError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err instanceof SettlementValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  throw err;
}

function parseSettlementBody(body: unknown, res: Response): SettlementInput | null {
  const { fromUser, toUser, amount } = (body ?? {}) as Record<string, unknown>;

  if (!Number.isInteger(fromUser) || (fromUser as number) <= 0) {
    res.status(400).json({ error: "fromUser must be a user id" });
    return null;
  }
  if (!Number.isInteger(toUser) || (toUser as number) <= 0) {
    res.status(400).json({ error: "toUser must be a user id" });
    return null;
  }

  const amountCents = parseMoneyToCents(amount);
  if (amountCents === null) {
    res.status(400).json({ error: "amount must be a positive number with at most 2 decimal places" });
    return null;
  }

  return { fromUserId: fromUser as number, toUserId: toUser as number, amountCents };
}

router.get("/balances", async (req, res) => {
  const groupId = parseGroupId(req.params);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  try {
    const result = await getGroupBalances(groupId, req.user!.id);
    res.json(result);
  } catch (err) {
    respondToSettlementError(err, res);
  }
});

router.post("/settlements", async (req, res) => {
  const groupId = parseGroupId(req.params);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  const input = parseSettlementBody(req.body, res);
  if (input === null) return;

  try {
    const settlement = await createSettlement(groupId, req.user!.id, input);
    res.status(201).json(settlement);
  } catch (err) {
    respondToSettlementError(err, res);
  }
});

router.get("/settlements", async (req, res) => {
  const groupId = parseGroupId(req.params);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  try {
    const settlements = await listSettlements(groupId, req.user!.id);
    res.json(settlements);
  } catch (err) {
    respondToSettlementError(err, res);
  }
});

export default router;
