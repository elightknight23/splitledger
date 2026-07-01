import { prisma } from "../lib/prisma";

export class GroupNotFoundError extends Error {}
export class NotGroupMemberError extends Error {}
export class UserNotFoundError extends Error {}
export class AlreadyMemberError extends Error {}

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

export async function addMemberByEmail(groupId: number, requesterId: number, email: string) {
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

  return prisma.groupMember.create({
    data: { groupId, userId: targetUser.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
