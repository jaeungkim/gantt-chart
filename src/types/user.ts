export interface User {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
}

// ======  API ======
export type ResponseGetUsers = User[];
