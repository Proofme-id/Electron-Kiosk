import { IAccessList } from "./accessList.interface";
import { IUser } from "./user.interface";

export interface IStorage {
  type: string;
  admin: IUser[];
  accessList: IAccessList[];
}
