import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type TaskStatus = 'Backlog' | 'Em andamento' | 'Revisão' | 'Concluído';
export type TaskPriority = 'Alta' | 'Média' | 'Baixa';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  capacity: number;
}

export interface TeamTask {
  id: string;
  title: string;
  project: string;
  owner: string;
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
export type MemberDraft = Omit<TeamMember, 'id'>;

export const taskStatuses: TaskStatus[] = ['Backlog', 'Em andamento', 'Revisão', 'Concluído'];
export const taskPriorities: TaskPriority[] = ['Alta', 'Média', 'Baixa'];

export const defaultTeamMembers: TeamMember[] = [
  { id: 'local-bruno', name: 'Bruno', role: 'Gestão', capacity: 8 },
  { id: 'local-laura', name: 'Laura', role: 'Marketing', capacity: 7 },
  { id: 'local-rafael', name: 'Rafael', role: 'Produto', capacity: 6 },
  { id: 'local-marina', name: 'Marina', role: 'Conteúdo', capacity: 6 },
];

export const defaultTasks: TeamTask[] = [
  {
    id: 'local-1',
    title: 'Revisar calendário da campanha Black Week',
    project: 'Lançamento Alpha',
    owner: 'Bruno',
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
    status: 'Revisão',
    priority: 'Alta',
    dueDate: '',
    effort: '2h',
    tags: ['Vendas', 'Financeiro'],
    notes: 'Conferir valores, parcelas e pixels.',
  },
];

export function subscribeTasks(onChange: (tasks: TeamTask[]) => void, onError: (error: FirestoreError) => void) {
  return onSnapshot(
    query(collection(db, 'activities'), orderBy('createdAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as TeamTask)),
    onError,
  );
}

export function subscribeTeamMembers(onChange: (members: TeamMember[]) => void, onError: (error: FirestoreError) => void) {
  return onSnapshot(
    query(collection(db, 'teamMembers'), orderBy('name', 'asc')),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as TeamMember)),
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

export async function createTeamMember(member: MemberDraft) {
  await addDoc(collection(db, 'teamMembers'), member);
}
