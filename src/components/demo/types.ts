export interface DemoMilestone {
  id: string;
  label: string;
  amount: number;
  status: "pending" | "sent";
  dueDate: string | null;
  invoiceNumber: number;
}

export interface DemoProject {
  id: string;
  clientName: string;
  projectName: string;
  totalValue: number;
  createdAt: string;
  milestones: DemoMilestone[];
}
