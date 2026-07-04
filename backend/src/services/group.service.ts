import { parseMoneyToCents } from "../lib/money";
import { prisma } from "../lib/prisma";

export class GroupNotFoundError extends Error {}
export class NotGroupMemberError extends Error {}
export class UserNotFoundError extends Error {}
export class AlreadyMemberError extends Error {}
export class AlreadyInvitedError extends Error {}
export class NotGroupCreatorError extends Error {}
export class CreatorCannotLeaveError extends Error {}
export class OutstandingBalanceError extends Error {}
export class InviteNotFoundError extends Error {}

const memberSelect = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

async function getGroupWithMembers(groupId: number) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: memberSelect,
  });
  if (!group) {
    throw new GroupNotFoundError(`Group ${groupId} not found`);
  }
  return group;
}

function assertIsMember(group: { members: { userId: number }[] }, userId: number) {
  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) {
    throw new NotGroupMemberError(`User ${userId} is not a member of this group`);
  }
}

export async function createGroup({ name, creatorId }: { name: string; creatorId: number }) {
  // Explicit transaction (rather than relying on Prisma's implicit nested-write
  // transaction) so the group and the creator's membership are demonstrably
  // atomic: either both rows exist or neither does.
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: { name, createdBy: creatorId },
    });
    await tx.groupMember.create({
      data: { groupId: group.id, userId: creatorId },
    });
    return group;
  });
}

export async function listGroupsForUser(userId: number) {
  return prisma.group.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroupDetail(groupId: number, userId: number) {
  const group = await getGroupWithMembers(groupId);
  assertIsMember(group, userId);
  return group;
}

const inviteInclude = {
  group: { select: { id: true, name: true } },
  invitedBy: { select: { id: true, name: true, email: true } },
  invitedUser: { select: { id: true, name: true, email: true } },
} as const;

// Members don't join directly anymore — they get a pending invite the
// recipient must accept. An invite row existing *is* the pending state.
export async function inviteMemberByEmail(groupId: number, requesterId: number, email: string) {
  const group = await getGroupWithMembers(groupId);
  assertIsMember(group, requesterId);

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    throw new UserNotFoundError(`No registered user with email ${email}`);
  }

  const alreadyMember = group.members.some((m) => m.userId === targetUser.id);
  if (alreadyMember) {
    throw new AlreadyMemberError(`${email} is already a member of this group`);
  }

  const existingInvite = await prisma.groupInvite.findUnique({
    where: { groupId_invitedUserId: { groupId, invitedUserId: targetUser.id } },
  });
  if (existingInvite) {
    throw new AlreadyInvitedError(`${email} already has a pending invite to this group`);
  }

  return prisma.groupInvite.create({
    data: { groupId, invitedUserId: targetUser.id, invitedById: requesterId },
    include: inviteInclude,
  });
}

export async function listInvitesForUser(userId: number) {
  return prisma.groupInvite.findMany({
    where: { invitedUserId: userId },
    include: inviteInclude,
    orderBy: { createdAt: "desc" },
  });
}

// Only the invited user may act on an invite; an invite addressed to someone
// else is reported as not-found rather than forbidden so its existence
// doesn't leak through id probing.
async function getOwnInvite(inviteId: number, userId: number) {
  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.invitedUserId !== userId) {
    throw new InviteNotFoundError(`Invite ${inviteId} not found`);
  }
  return invite;
}

export async function acceptInvite(inviteId: number, userId: number) {
  const invite = await getOwnInvite(inviteId, userId);

  // Membership creation and invite removal are atomic: no state where both
  // (or neither) exist after this call.
  return prisma.$transaction(async (tx) => {
    const membership = await tx.groupMember.create({
      data: { groupId: invite.groupId, userId },
      include: { group: { select: { id: true, name: true } } },
    });
    await tx.groupInvite.delete({ where: { id: invite.id } });
    return membership;
  });
}

export async function declineInvite(inviteId: number, userId: number) {
  const invite = await getOwnInvite(inviteId, userId);
  await prisma.groupInvite.delete({ where: { id: invite.id } });
}

// Net position for one member, computed with DB-side sums instead of pulling
// every row the way getGroupBalances does — leave/checks only need this one
// number. Same ledger math: paid − owed + settled-out − settled-in.
async function getMemberNetCents(groupId: number, userId: number): Promise<number> {
  const [paid, owed, settledOut, settledIn] = await Promise.all([
    prisma.expense.aggregate({ where: { groupId, paidBy: userId }, _sum: { amount: true } }),
    prisma.expenseSplit.aggregate({
      where: { expense: { groupId }, userId },
      _sum: { shareAmount: true },
    }),
    prisma.settlement.aggregate({ where: { groupId, fromUser: userId }, _sum: { amount: true } }),
    prisma.settlement.aggregate({ where: { groupId, toUser: userId }, _sum: { amount: true } }),
  ]);

  const toCents = (v: { toString(): string } | null) =>
    v === null ? 0 : (parseMoneyToCents(v.toString()) ?? 0);

  return (
    toCents(paid._sum.amount) -
    toCents(owed._sum.shareAmount) +
    toCents(settledOut._sum.amount) -
    toCents(settledIn._sum.amount)
  );
}

export async function leaveGroup(groupId: number, userId: number) {
  const group = await getGroupWithMembers(groupId);
  assertIsMember(group, userId);

  // The creator owns deletion rights; letting them walk away would orphan
  // the group with no one able to delete it.
  if (group.createdBy === userId) {
    throw new CreatorCannotLeaveError(
      "The group creator cannot leave. Delete the group instead."
    );
  }

  const netCents = await getMemberNetCents(groupId, userId);
  if (netCents !== 0) {
    throw new OutstandingBalanceError(
      netCents < 0
        ? "You still owe money in this group. Settle up before leaving."
        : "You are still owed money in this group. Settle up before leaving."
    );
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
}

export async function deleteGroup(groupId: number, requesterId: number) {
  const group = await getGroupWithMembers(groupId);
  assertIsMember(group, requesterId);

  if (group.createdBy !== requesterId) {
    throw new NotGroupCreatorError("Only the group creator can delete this group");
  }

  // One transaction for the whole teardown. Splits cascade from expense
  // deletion and invites cascade from group deletion (both DB-level FKs);
  // expenses, settlements, and memberships have no cascade so they're
  // removed explicitly, children before parent.
  await prisma.$transaction(async (tx) => {
    await tx.expense.deleteMany({ where: { groupId } });
    await tx.settlement.deleteMany({ where: { groupId } });
    await tx.groupMember.deleteMany({ where: { groupId } });
    await tx.group.delete({ where: { id: groupId } });
  });
}
