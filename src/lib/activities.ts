import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  updateDoc,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './auth';

export type TaskStatus = 'Backlog' | 'Em andamento' | 'Revisão' | 'Concluído';
export type TaskPriority = 'Alta' | 'Média' | 'Baixa';
export type RoutineFrequency = 'daily' | 'weekly';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  capacity: number;
  email: string;
}

export interface TeamRoutine {
  id: string;
  title: string;
  project: string;
  owner: string;
  ownerEmail: string;
  priority: TaskPriority;
  startDate: string;
  time: string;
  frequency: RoutineFrequency;
  weekdays: number[];
  completedOccurrences: string[];
  notes: string;
  tags: string[];
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TeamTask {
  id: string;
  title: string;
  project: string;
  owner: string;
  ownerEmail: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  effort: string;
  tags: string[];
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TaskDraft = Omit<TeamTask, 'id' | 'createdAt' | 'updatedAt'>;
export type RoutineDraft = Omit<TeamRoutine, 'id' | 'createdAt' | 'updatedAt'>;
export type MemberDraft = Omit<TeamMember, 'id'>;

export const taskStatuses: TaskStatus[] = ['Backlog', 'Em andamento', 'Revisão', 'Concluído'];
export const taskPriorities: TaskPriority[] = ['Alta', 'Média', 'Baixa'];

export const defaultTeamMembers: TeamMember[] = [
  { id: 'local-bruno', name: 'Bruno', role: 'Gestão', capacity: 8, email: 'bruno@simplicio.local' },
  { id: 'local-laura', name: 'Laura', role: 'Marketing', capacity: 7, email: 'laura@simplicio.local' },
  { id: 'local-rafael', name: 'Rafael', role: 'Produto', capacity: 6, email: 'rafael@simplicio.local' },
  { id: 'local-marina', name: 'Marina', role: 'Conteúdo', capacity: 6, email: 'marina@simplicio.local' },
];

export const defaultTasks: TeamTask[] = [
  {
    id: 'local-1',
    title: 'Revisar calendário da campanha Black Week',
    project: 'Lançamento Alpha',
    owner: 'Bruno',
    ownerEmail: 'bruno@simplicio.local',
    status: 'Em andamento',
    priority: 'Alta',
    dueDate: new Date().toISOString().slice(0, 10),
    effort: '3h',
    tags: ['Marketing', 'Estratégia'],
    notes: 'Alinhar ofertas e prazos com o time.',
  },
  {
    id: 'local-2',
    title: 'Publicar nova sequência de e-mails',
    project: 'Mentoria VIP',
    owner: 'Laura',
    ownerEmail: 'laura@simplicio.local',
    status: 'Backlog',
    priority: 'Média',
    dueDate: '',
    effort: '5h',
    tags: ['CRM', 'Copy'],
    notes: '',
  },
  {
    id: 'local-3',
    title: 'Validar página de checkout com financeiro',
    project: 'Curso Cripto',
    owner: 'Rafael',
    ownerEmail: 'rafael@simplicio.local',
    status: 'Revisão',
    priority: 'Alta',
    dueDate: '',
    effort: '2h',
    tags: ['Vendas', 'Financeiro'],
    notes: 'Conferir valores, parcelas e pixels.',
  },
];

export function subscribeTasks(profile: UserProfile, onChange: (tasks: TeamTask[]) => void, onError: (error: FirestoreError) => void) {
  const tasksQuery = profile.role === 'admin'
    ? query(collection(db, 'activities'), orderBy('createdAt', 'desc'))
    : query(
        collection(db, 'activities'),
        where('ownerEmail', '==', profile.email),
        where('status', 'in', ['Em andamento', 'Revisão', 'Concluído']),
      );

  return onSnapshot(
    tasksQuery,
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as TeamTask)),
    onError,
  );
}

export function subscribeTeamMembers(onChange: (members: TeamMember[]) => void, onError: (error: FirestoreError) => void) {
  return onSnapshot(
    query(collection(db, 'allowedUsers'), orderBy('name', 'asc')),
    (snapshot) => onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: data.name || data.email || item.id,
        role: data.role === 'admin' ? 'Admin' : 'Colaborador',
        capacity: 1,
        email: data.email || item.id,
      } as TeamMember;
    })),
    onError,
  );
}


export function subscribeRoutines(profile: UserProfile, onChange: (routines: TeamRoutine[]) => void, onError: (error: FirestoreError) => void) {
  const routinesQuery = profile.role === 'admin'
    ? query(collection(db, 'activityRoutines'), orderBy('createdAt', 'desc'))
    : query(collection(db, 'activityRoutines'), where('ownerEmail', '==', profile.email));

  return onSnapshot(
    routinesQuery,
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as TeamRoutine)),
    onError,
  );
}

export async function createTask(task: TaskDraft) {
  await addDoc(collection(db, 'activities'), {
    ...task,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(id: string, task: Partial<TaskDraft>) {
  await updateDoc(doc(db, 'activities', id), {
    ...task,
    updatedAt: serverTimestamp(),
  });
}

export async function removeTask(id: string) {
  await deleteDoc(doc(db, 'activities', id));
}

export async function createRoutine(routine: RoutineDraft) {
  await addDoc(collection(db, 'activityRoutines'), {
    ...routine,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateRoutine(id: string, routine: Partial<RoutineDraft>) {
  await updateDoc(doc(db, 'activityRoutines', id), {
    ...routine,
    updatedAt: serverTimestamp(),
  });
}

export async function removeRoutine(id: string) {
  await deleteDoc(doc(db, 'activityRoutines', id));
}

export async function createTeamMember(member: MemberDraft) {
  const normalizedEmail = member.email.trim().toLowerCase();
  if (!normalizedEmail) return;

  await setDoc(doc(db, 'allowedUsers', normalizedEmail), {
    email: normalizedEmail,
    name: member.name.trim() || normalizedEmail,
    role: 'collaborator',
    active: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
