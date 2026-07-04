import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  InviteNotFoundError,
  acceptInvite,
  declineInvite,
  listInvitesForUser,
} from "../services/group.service";

// The recipient's side of the invite flow (the sender's side lives on
// /groups/:id/invites): list what's pending for me, accept, or decline.
const router = Router();

router.use(requireAuth);

function parseInviteId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/", async (req, res) => {
  const invites = await listInvitesForUser(req.user!.id);
  res.json(invites);
});

router.post("/:id/accept", async (req, res) => {
  const inviteId = parseInviteId(req.params.id);
  if (inviteId === null) {
    res.status(400).json({ error: "Invalid invite id" });
    return;
  }

  try {
    const membership = await acceptInvite(inviteId, req.user!.id);
    res.status(201).json(membership);
  } catch (err) {
    if (err instanceof InviteNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/:id/decline", async (req, res) => {
  const inviteId = parseInviteId(req.params.id);
  if (inviteId === null) {
    res.status(400).json({ error: "Invalid invite id" });
    return;
  }

  try {
    await declineInvite(inviteId, req.user!.id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof InviteNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
