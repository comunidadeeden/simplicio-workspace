import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';

export const ADMIN_EMAIL = 'gu.correa98@gmail.com';

export type UserRole = 'admin' | 'collaborator';
export type AccessStatus = 'loading' | 'signed-out' | 'authorized' | 'denied';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: UserRole;
  active: boolean;
}

export interface AllowedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export function isAdminEmail(email?: string | null) {
  return (email ?? '').toLowerCase() === ADMIN_EMAIL;
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
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

  const profile: UserProfile = {
    uid: user.uid,
    email,
    name: user.displayName || email,
    photoURL: user.photoURL || '',
    role: admin ? 'admin' : 'collaborator',
    active: true,
  };

  await setDoc(profileRef, { ...profile, updatedAt: serverTimestamp() }, { merge: true });

  if (admin) {
    await setDoc(allowedRef, {
      email,
      name: profile.name,
      role: 'admin',
      active: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return profile;
}

export function subscribeAllowedUsers(onChange: (users: AllowedUser[]) => void) {
  return onSnapshot(query(collection(db, 'allowedUsers'), orderBy('email', 'asc')), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AllowedUser));
  });
}

export async function addAllowedUser(email: string, name: string, role: UserRole = 'collaborator') {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await setDoc(doc(db, 'allowedUsers', normalized), {
    email: normalized,
    name: name.trim() || normalized,
    role,
    active: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function removeAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || isAdminEmail(normalized)) return;
  await deleteDoc(doc(db, 'allowedUsers', normalized));
}
