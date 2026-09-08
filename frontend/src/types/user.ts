export type AccountStatus = "pending" | "approved" | "rejected";

export type UserDocument = {
  email: string;
  passwordHash: string;
  companyName: string;
  taxId: string;
  contactName: string;
  phone: string;
  address: string;
  specialty: string;
  size: string;
  status: AccountStatus;
  createdAt: Date;
};
