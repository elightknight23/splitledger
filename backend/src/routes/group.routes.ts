import { Router } from "express";
import { SUPPORTED_CURRENCIES, isSupportedCurrency } from "../lib/currency";
import { requireAuth } from "../middleware/auth.middleware";
import {
  AlreadyInvitedError,
  AlreadyMemberError,
  CreatorCannotLeaveError,
  GroupNotFoundError,
  NotGroupCreatorError,
  NotGroupMemberError,
  OutstandingBalanceError,
  UserNotFoundError,
  createGroup,
  deleteGroup,
  getGroupDetail,
  inviteMemberByEmail,
  leaveGroup,
  listGroupsForUser,
} from "../services/group.service";

const router = Router();

router.use(requireAuth);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseGroupId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

router.post("/", async (req, res) => {
  const { name, currency } = req.body ?? {};
  if (!isNonEmptyString(name)) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  // Currency is optional (defaults to USD) but immutable after creation —
  // changing it later would silently re-denominate every existing expense.
  if (currency !== undefined && !isSupportedCurrency(currency)) {
    res.status(400).json({
      error: `currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
    });
    return;
  }

  const group = await createGroup({
    name,
    currency: currency ?? "USD",
    creatorId: req.user!.id,
  });
  res.status(201).json(group);
});

router.get("/", async (req, res) => {
  const groups = await listGroupsForUser(req.user!.id);
  res.json(groups);
});

router.get("/:id", async (req, res) => {
  const groupId = parseGroupId(req.params.id);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  try {
    const group = await getGroupDetail(groupId, req.user!.id);
    res.json(group);
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof NotGroupMemberError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Replaces the old direct-add POST /:id/members — joining now requires the
// invited user to accept (see invite.routes.ts for the recipient's side).
router.post("/:id/invites", async (req, res) => {
  const groupId = parseGroupId(req.params.id);
  const { email } = req.body ?? {};

  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }
  if (!isNonEmptyString(email)) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  try {
    const invite = await inviteMemberByEmail(groupId, req.user!.id, email);
    res.status(201).json(invite);
  } catch (err) {
    if (err instanceof GroupNotFoundError || err instanceof UserNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof NotGroupMemberError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof AlreadyMemberError || err instanceof AlreadyInvitedError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/:id/leave", async (req, res) => {
  const groupId = parseGroupId(req.params.id);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  try {
    await leaveGroup(groupId, req.user!.id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof NotGroupMemberError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof CreatorCannotLeaveError || err instanceof OutstandingBalanceError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const groupId = parseGroupId(req.params.id);
  if (groupId === null) {
    res.status(400).json({ error: "Invalid group id" });
    return;
  }

  try {
    await deleteGroup(groupId, req.user!.id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof NotGroupMemberError || err instanceof NotGroupCreatorError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
