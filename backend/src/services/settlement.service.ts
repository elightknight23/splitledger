import { centsToDecimalString, parseMoneyToCents } from "../lib/money";
import { prisma } from "../lib/prisma";
import { GroupNotFoundError, NotGroupMemberError } from "./group.service";

export class SettlementValidationError extends Error {}

interface Member {
  id: number;
  name: string;
  email: string;
}

interface Balance {
  userId: number;
  balanceCents: number;
}

export interface Suggestion {
  fromUserId: number;
  toUserId: number;
  amountCents: number;
}

async function getGroupMembersOrThrow(groupId: number): Promise<Member[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!group) {
    throw new GroupNotFoundError(`Group ${groupId} not found`);
  }
  return group.members.map((m) => m.user);
}

function assertIsMember(members: Member[], userId: number) {
  if (!members.some((u) => u.id === userId)) {
    throw new NotGroupMemberError(`User ${userId} is not a member of this group`);
  }
}

// Pure and DB-free by design: net every balance, split into creditors/debtors,
// then repeatedly re-sort and match the current largest creditor against the
// current largest debtor until every balance hits zero. Re-sorting each pass
// (rather than a single-pass two-pointer walk over presorted lists) keeps the
// "always match the two largest remaining" invariant obviously true instead
// of relying on a non-trivial proof that a presorted two-pointer still visits
// pairs in that order after partial consumption — group sizes here are small
// enough that the O(n^2 log n) cost is irrelevant, and interview-explainability
// matters more than shaving constant factors.
export function calculateSuggestedSettlements(balances: Balance[]): Suggestion[] {
  let creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ userId: b.userId, remainingCents: b.balanceCents }));
  let debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ userId: b.userId, remainingCents: -b.balanceCents }));

  const suggestions: Suggestion[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.remainingCents - a.remainingCents);
    debtors.sort((a, b) => b.remainingCents - a.remainingCents);

    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amountCents = Math.min(creditor.remainingCents, debtor.remainingCents);

    suggestions.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents });

    creditor.remainingCents -= amountCents;
    debtor.remainingCents -= amountCents;
    creditors = creditors.filter((c) => c.remainingCents > 0);
    debtors = debtors.filter((d) => d.remainingCents > 0);
  }

  return suggestions;
}

export async function getGroupBalances(groupId: number, requesterId: number) {
  const members = await getGroupMembersOrThrow(groupId);
  assertIsMember(members, requesterId);

  const balanceCents = new Map<number, number>(members.map((u) => [u.id, 0]));

  // Balances are never read from or written to a stored column — every call
  // recomputes them from the ledger of expenses, splits, and settlements.
  const [expenses, splits, settlements] = await Promise.all([
    prisma.expense.findMany({ where: { groupId }, select: { amount: true, paidBy: true } }),
    prisma.expenseSplit.findMany({
      where: { expense: { groupId } },
      select: { shareAmount: true, userId: true },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { amount: true, fromUser: true, toUser: true },
    }),
  ]);

  // paidBy fronted the money (their net position goes up); each split holder
  // owes their share (their net position goes down).
  for (const expense of expenses) {
    const cents = parseMoneyToCents(expense.amount.toString()) ?? 0;
    balanceCents.set(expense.paidBy, (balanceCents.get(expense.paidBy) ?? 0) + cents);
  }
  for (const split of splits) {
    const cents = parseMoneyToCents(split.shareAmount.toString()) ?? 0;
    balanceCents.set(split.userId, (balanceCents.get(split.userId) ?? 0) - cents);
  }
  // A settlement is real money changing hands outside the ledger: fromUser
  // paying reduces what they owe (position goes up), toUser being paid
  // reduces what's owed to them (position goes down).
  for (const settlement of settlements) {
    const cents = parseMoneyToCents(settlement.amount.toString()) ?? 0;
    balanceCents.set(settlement.fromUser, (balanceCents.get(settlement.fromUser) ?? 0) + cents);
    balanceCents.set(settlement.toUser, (balanceCents.get(settlement.toUser) ?? 0) - cents);
  }

  const membersById = new Map(members.map((u) => [u.id, u]));
  const balances = members.map((user) => ({
    user,
    amount: centsToDecimalString(balanceCents.get(user.id) ?? 0),
  }));

  const suggestions = calculateSuggestedSettlements(
    members.map((u) => ({ userId: u.id, balanceCents: balanceCents.get(u.id) ?? 0 }))
  );
  const suggestedSettlements = suggestions.map((s) => ({
    from: membersById.get(s.fromUserId)!,
    to: membersById.get(s.toUserId)!,
    amount: centsToDecimalString(s.amountCents),
  }));

  return { balances, suggestedSettlements };
}

export interface SettlementInput {
  fromUserId: number;
  toUserId: number;
  amountCents: number;
}

const settlementInclude = {
  fromUserRef: { select: { id: true, name: true, email: true } },
  toUserRef: { select: { id: true, name: true, email: true } },
} as const;

export async function createSettlement(
  groupId: number,
  requesterId: number,
  input: SettlementInput
) {
  const members = await getGroupMembersOrThrow(groupId);
  assertIsMember(members, requesterId);
  assertIsMember(members, input.fromUserId);
  assertIsMember(members, input.toUserId);

  if (input.fromUserId === input.toUserId) {
    throw new SettlementValidationError("fromUser and toUser must be different users");
  }

  // A single insert is already atomic on its own; wrapped in $transaction to
  // honor the "settlement writes are transactional" guardrail explicitly and
  // to leave room for a future paired write (e.g. an activity-feed row)
  // without having to revisit atomicity later.
  return prisma.$transaction((tx) =>
    tx.settlement.create({
      data: {
        groupId,
        fromUser: input.fromUserId,
        toUser: input.toUserId,
        amount: centsToDecimalString(input.amountCents),
      },
      include: settlementInclude,
    })
  );
}

export async function listSettlements(groupId: number, requesterId: number) {
  const members = await getGroupMembersOrThrow(groupId);
  assertIsMember(members, requesterId);

  return prisma.settlement.findMany({
    where: { groupId },
    include: settlementInclude,
    orderBy: { settledAt: "desc" },
  });
}
