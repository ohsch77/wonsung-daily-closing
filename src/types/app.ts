export type ManagerRole =
  | "manager"
  | "admin";

export type ManagerProfile = {
  id: string;
  employee_no: string;
  name: string;
  role: ManagerRole;
  is_active: boolean;
  display_order: number | null;
};