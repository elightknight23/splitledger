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
