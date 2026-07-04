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
