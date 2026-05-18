import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';

export const ADMIN_EMAIL = 'gu.correa98@gmail.com';

export type UserRole = 'admin' | 'collaborator';
export type AccessStatus = 'loading' | 'signed-out' | 'authorized' | 'denied';
export type AppPage = 'dashboard' | 'activities' | 'finance' | 'launches' | 'leads' | 'team' | 'settings';

export const DEFAULT_COLLABORATOR_PERMISSIONS: AppPage[] = ['dashboard', 'activities'];
export const ADMIN_PERMISSIONS: AppPage[] = ['dashboard', 'activities', 'finance', 'launches', 'leads', 'team', 'settings'];

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: UserRole;
  active: boolean;
  permissions: AppPage[];
}

export interface AllowedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  permissions: AppPage[];
}

export function isAdminEmail(email?: string | null) {
  return (email ?? '').toLowerCase() === ADMIN_EMAIL;
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider());
}

export async function signInWithGoogleRedirect() {
  await signInWithRedirect(auth, googleProvider());
}

export async function logout() {
  await signOut(auth);
}

export async function loadOrCreateProfile(user: User): Promise<UserProfile | null> {
  const email = user.email?.toLowerCase();
  if (!email) return null;

  const admin = isAdminEmail(email);
  const allowedRef = doc(db, 'allowedUsers', email);
  const profileRef = doc(db, 'users', user.uid);

  if (!admin) {
    const allowed = await getDoc(allowedRef);
    if (!allowed.exists() || allowed.data().active === false) return null;
  }

  const allowedSnapshot = admin ? null : await getDoc(allowedRef);
  const allowedData = allowedSnapshot?.data();
  const profile: UserProfile = {
    uid: user.uid,
    email,
    name: user.displayName || allowedData?.name || email,
    photoURL: user.photoURL || '',
    role: admin ? 'admin' : 'collaborator',
    active: true,
    permissions: admin ? ADMIN_PERMISSIONS : normalizePermissions(allowedData?.permissions),
  };

  await setDoc(profileRef, { ...profile, updatedAt: serverTimestamp() }, { merge: true });

  if (admin) {
    await setDoc(allowedRef, {
      email,
      name: profile.name,
      role: 'admin',
      active: true,
      permissions: ADMIN_PERMISSIONS,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return profile;
}

export function subscribeAllowedUsers(onChange: (users: AllowedUser[]) => void) {
  return onSnapshot(query(collection(db, 'allowedUsers'), orderBy('email', 'asc')), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), permissions: normalizePermissions(item.data().permissions) }) as AllowedUser));
  });
}

export async function addAllowedUser(email: string, name: string, role: UserRole = 'collaborator', permissions: AppPage[] = DEFAULT_COLLABORATOR_PERMISSIONS) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await setDoc(doc(db, 'allowedUsers', normalized), {
    email: normalized,
    name: name.trim() || normalized,
    role,
    active: true,
    permissions: role === 'admin' ? ADMIN_PERMISSIONS : normalizePermissions(permissions),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateAllowedUser(email: string, patch: Partial<Omit<AllowedUser, 'id' | 'email'>>) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || isAdminEmail(normalized)) return;
  const payload: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  if (patch.permissions) payload.permissions = normalizePermissions(patch.permissions);
  await updateDoc(doc(db, 'allowedUsers', normalized), payload);
}

export async function removeAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || isAdminEmail(normalized)) return;
  await deleteDoc(doc(db, 'allowedUsers', normalized));
}


export function normalizePermissions(value: unknown): AppPage[] {
  if (!Array.isArray(value)) return DEFAULT_COLLABORATOR_PERMISSIONS;
  const allowed = new Set<AppPage>(ADMIN_PERMISSIONS);
  const normalized = value.filter((item): item is AppPage => typeof item === 'string' && allowed.has(item as AppPage));
  return normalized.length ? Array.from(new Set(normalized)) : DEFAULT_COLLABORATOR_PERMISSIONS;
}

export function hasPageAccess(profile: UserProfile, page: AppPage) {
  if (profile.role === 'admin') return true;
  return profile.permissions.includes(page);
}
