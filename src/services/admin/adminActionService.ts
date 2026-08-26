import { callFunction } from '../functions/functionsClient';

type Role = 'user' | 'admin' | 'super_admin';

export const setUserRoleDirectly = async ({
  email,
  uid,
  role,
}: {
  email?: string | null;
  uid?: string;
  role: Role;
}) => {
  await callFunction('setUserRole', { email: email ?? undefined, uid, role });
};

export const deleteUserDirectly = async ({
  email,
  uid,
}: {
  email?: string | null;
  uid?: string;
}) => {
  await callFunction('deleteUserFully', { email: email ?? undefined, uid });
};
