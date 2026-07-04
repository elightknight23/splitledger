export interface Group {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
}

export interface GroupMemberUser {
  id: number;
  name: string;
  email: string;
}

export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  joinedAt: string;
  user: GroupMemberUser;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface ExpenseSplit {
  id: number;
  expenseId: number;
  userId: number;
  // Decimal string from the backend (e.g. "100" or "33.34"), not a fixed
  // 2-decimal format — always format for display, never string-compare.
  shareAmount: string;
  user: GroupMemberUser;
}

export interface Expense {
  id: number;
  groupId: number;
  paidBy: number;
  amount: string;
  description: string;
  createdAt: string;
  payer: GroupMemberUser;
  splits: ExpenseSplit[];
}

export interface Settlement {
  id: number;
  groupId: number;
  fromUser: number;
  toUser: number;
  amount: string;
  settledAt: string;
  fromUserRef: GroupMemberUser;
  toUserRef: GroupMemberUser;
}

export interface Balance {
  user: GroupMemberUser;
  amount: string;
}

export interface SuggestedSettlement {
  from: GroupMemberUser;
  to: GroupMemberUser;
  amount: string;
}

export interface BalancesResponse {
  balances: Balance[];
  suggestedSettlements: SuggestedSettlement[];
}

// A pending invitation for the current user (rows only exist while pending —
// accepting or declining removes them server-side).
export interface GroupInvite {
  id: number;
  groupId: number;
  invitedUserId: number;
  invitedById: number;
  createdAt: string;
  group: { id: number; name: string };
  invitedBy: GroupMemberUser;
  invitedUser: GroupMemberUser;
}
