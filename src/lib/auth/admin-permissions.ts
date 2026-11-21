import { adminAc, userAc } from "better-auth/plugins/admin/access";

export const adminRolesConfig = {
  super_admin: adminAc,
  committee: userAc,
};
