import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  AlreadyMemberError,
  GroupNotFoundError,
  NotGroupMemberError,
  UserNotFoundError,
  addMemberByEmail,
  createGroup,
  getGroupDetail,
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
  const { name } = req.body ?? {};
  if (!isNonEmptyString(name)) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const group = await createGroup({ name, creatorId: req.user!.id });
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

router.post("/:id/members", async (req, res) => {
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
    const membership = await addMemberByEmail(groupId, req.user!.id, email);
    res.status(201).json(membership);
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof NotGroupMemberError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof AlreadyMemberError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
