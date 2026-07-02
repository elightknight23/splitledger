import { centsToDecimalString } from "../lib/money";
import { prisma } from "../lib/prisma";
import { GroupNotFoundError, NotGroupMemberError } from "./group.service";

export class ExpenseNotFoundError extends Error {}
export class NotExpensePayerError extends Error {}
export class ExpenseValidationError extends Error {}

export type SplitInput =
  | { type: "equal" }
  | { type: "custom"; shares: { userId: number; shareCents: number }[] };

export interface ExpenseInput {
  description: string;
  amountCents: number;
  paidBy: number;
  split: SplitInput;
}

const expenseInclude = {
  payer: { select: { id: true, name: true, email: true } },
  splits: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { userId: "asc" },
  },
} as const;

async function getGroupMemberIds(groupId: number): Promise<number[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { members: { select: { userId: true } } },
  });
  if (!group) {
    throw new GroupNotFoundError(`Group ${groupId} not found`);
  }
  return group.members.map((m) => m.userId);
}

function assertIsMember(memberIds: number[], userId: number) {
  if (!memberIds.includes(userId)) {
    throw new NotGroupMemberError(`User ${userId} is not a member of this group`);
  }
}

// Equal splits can't always divide evenly (e.g. 100.00 / 3), so the leftover
// cents go one each to the first members in id order. Deterministic, and the
// shares still sum exactly to the total — which is the invariant that matters.
function buildEqualShares(memberIds: number[], amountCents: number) {
  const sorted = [...memberIds].sort((a, b) => a - b);
  const base = Math.floor(amountCents / sorted.length);
  const remainder = amountCents - base * sorted.length;
  return sorted.map((userId, i) => ({
    userId,
    shareCents: base + (i < remainder ? 1 : 0),
  }));
}

function buildShares(memberIds: number[], { amountCents, split }: ExpenseInput) {
  if (split.type === "equal") {
    return buildEqualShares(memberIds, amountCents);
  }

  const { shares } = split;
  if (shares.length === 0) {
    throw new ExpenseValidationError("Custom split needs at least one share");
  }

  const seen = new Set<number>();
  for (const share of shares) {
    if (seen.has(share.userId)) {
      throw new ExpenseValidationError(`User ${share.userId} appears in more than one split`);
    }
    seen.add(share.userId);
    if (!memberIds.includes(share.userId)) {
      throw new ExpenseValidationError(`User ${share.userId} is not a member of this group`);
    }
  }

  const sumCents = shares.reduce((sum, s) => sum + s.shareCents, 0);
  if (sumCents !== amountCents) {
    throw new ExpenseValidationError(
      `Split amounts sum to ${centsToDecimalString(sumCents)} but the expense total is ${centsToDecimalString(amountCents)}`
    );
  }

  return shares;
}

function validatePayerAndBuildShares(memberIds: number[], input: ExpenseInput) {
  if (!memberIds.includes(input.paidBy)) {
    throw new ExpenseValidationError(`Payer (user ${input.paidBy}) must be a member of the group`);
  }
  return buildShares(memberIds, input);
}

export async function createExpense(groupId: number, requesterId: number, input: ExpenseInput) {
  const memberIds = await getGroupMemberIds(groupId);
  assertIsMember(memberIds, requesterId);
  const shares = validatePayerAndBuildShares(memberIds, input);

  // One transaction: an expense without its splits (or vice versa) would
  // corrupt every balance derived from them.
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        groupId,
        paidBy: input.paidBy,
        amount: centsToDecimalString(input.amountCents),
        description: input.description,
      },
    });
    await tx.expenseSplit.createMany({
      data: shares.map((s) => ({
        expenseId: expense.id,
        userId: s.userId,
        shareAmount: centsToDecimalString(s.shareCents),
      })),
    });
    return tx.expense.findUniqueOrThrow({ where: { id: expense.id }, include: expenseInclude });
  });
}

export async function listExpenses(groupId: number, requesterId: number) {
  const memberIds = await getGroupMemberIds(groupId);
  assertIsMember(memberIds, requesterId);

  return prisma.expense.findMany({
    where: { groupId },
    include: expenseInclude,
    orderBy: { createdAt: "desc" },
  });
}

async function getOwnedExpense(groupId: number, expenseId: number, requesterId: number) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  // Treat an expense that exists but belongs to another group as not found —
  // its id shouldn't leak anything through this group's URL.
  if (!expense || expense.groupId !== groupId) {
    throw new ExpenseNotFoundError(`Expense ${expenseId} not found in this group`);
  }
  if (expense.paidBy !== requesterId) {
    throw new NotExpensePayerError("Only the member who paid for an expense can modify it");
  }
  return expense;
}

export async function updateExpense(
  groupId: number,
  expenseId: number,
  requesterId: number,
  input: ExpenseInput
) {
  // Membership before ownership: a non-member probing an expense id must get
  // the same 403 as any other group route, not learn whether the id exists.
  const memberIds = await getGroupMemberIds(groupId);
  assertIsMember(memberIds, requesterId);
  await getOwnedExpense(groupId, expenseId, requesterId);
  const shares = validatePayerAndBuildShares(memberIds, input);

  // Splits are replaced wholesale (PUT semantics): delete + recreate in the
  // same transaction as the expense update so no reader ever sees a mix.
  return prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        paidBy: input.paidBy,
        amount: centsToDecimalString(input.amountCents),
        description: input.description,
      },
    });
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expenseSplit.createMany({
      data: shares.map((s) => ({
        expenseId,
        userId: s.userId,
        shareAmount: centsToDecimalString(s.shareCents),
      })),
    });
    return tx.expense.findUniqueOrThrow({ where: { id: expenseId }, include: expenseInclude });
  });
}

export async function deleteExpense(groupId: number, expenseId: number, requesterId: number) {
  const memberIds = await getGroupMemberIds(groupId);
  assertIsMember(memberIds, requesterId);
  await getOwnedExpense(groupId, expenseId, requesterId);

  // Splits are removed by the DB via the ON DELETE CASCADE on
  // expense_splits.expense_id — no second query needed.
  await prisma.expense.delete({ where: { id: expenseId } });
}
