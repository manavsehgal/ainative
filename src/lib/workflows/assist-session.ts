import type { TaskAssistResponse } from "@/lib/agents/runtime/task-assist-types";

const STORAGE_KEY = "stagent:workflow-from-assist";

export interface WorkflowAssistState {
  assistResult: TaskAssistResponse;
  formState: {
    title: string;
    description: string;
    projectId: string;
    priority: string;
    agentProfile: string;
    assignedAgent: string;
  };
}

export function saveAssistState(state: WorkflowAssistState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable (e.g. SSR)
  }
}

export function loadAssistState(): WorkflowAssistState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkflowAssistState;
  } catch {
    return null;
  }
}

export function clearAssistState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

const FORM_RESTORE_KEY = "stagent:task-form-restore";

export interface TaskFormState {
  title: string;
  description: string;
  projectId: string;
  priority: string;
  agentProfile: string;
  assignedAgent: string;
}

export function saveTaskFormState(state: TaskFormState): void {
  try {
    sessionStorage.setItem(FORM_RESTORE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
}

export function loadTaskFormState(): TaskFormState | null {
  try {
    const raw = sessionStorage.getItem(FORM_RESTORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TaskFormState;
  } catch {
    return null;
  }
}

export function clearTaskFormState(): void {
  try {
    sessionStorage.removeItem(FORM_RESTORE_KEY);
  } catch {
    // noop
  }
}
