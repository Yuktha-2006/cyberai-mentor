/**
 * Typed API client for CyberMentor AI.
 * All requests go to the backend — no secrets in this file.
 * Uses credentials: 'include' so HttpOnly cookies are sent automatically.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    let detail = 'Request failed'
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {}
    throw new ApiError(res.status, detail)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface UserOut {
  id: string
  email: string
  full_name: string
  role: string
  xp_total: number
  level: number
  onboarding_completed: boolean
}

export interface AuthResponse {
  user: UserOut
  message: string
}

export const auth = {
  register: (body: { full_name: string; email: string; password: string }) =>
    request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  logout: () =>
    request<void>('/api/v1/auth/logout', { method: 'POST' }),

  me: () =>
    request<UserOut>('/api/v1/auth/me'),
}

// ── Learning ─────────────────────────────────────────────────────────────────

export interface ModuleOut {
  id: string
  slug: string
  title: string
  description: string
  career_path: string
  difficulty: string
  xp_reward: number
  lesson_count: number
}

export interface LessonOut {
  id: string
  slug: string
  title: string
  content_md: string
  order_index: number
  xp_reward: number
  estimated_minutes: number
}

export interface QuizQuestion {
  id: string
  question_text: string
  options: { id: string; text: string }[]
  points: number
  order_index: number
}

export interface QuizOut {
  id: string
  slug: string
  title: string
  description: string | null
  passing_score: number
  max_attempts: number
  time_limit_minutes: number | null
  xp_reward: number
  questions: QuizQuestion[]
}

export interface AttemptResult {
  attempt_id: string
  score: number
  passed: boolean
  attempt_number: number
  xp_awarded: boolean
  xp_amount: number
  per_question: {
    question_id: string
    correct: boolean
    correct_option_id: string
    selected_option_id: string | undefined
    explanation: string | null
    points_earned: number
    points_possible: number
  }[]
  message: string
}

export interface ProgressOut {
  completed_lessons: string[]
  quiz_best_scores: Record<string, number>
  xp_total: number
  level: number
}

export const learn = {
  modules: () =>
    request<ModuleOut[]>('/api/v1/learn/modules'),

  lessons: (moduleSlug: string) =>
    request<LessonOut[]>(`/api/v1/learn/modules/${moduleSlug}/lessons`),

  lesson: (lessonSlug: string) =>
    request<LessonOut>(`/api/v1/learn/lessons/${lessonSlug}`),

  completeLesson: (lessonId: string) =>
    request<{ xp_awarded: boolean; xp_amount: number; message: string }>(
      `/api/v1/learn/lessons/${lessonId}/complete`,
      { method: 'POST' },
    ),

  quiz: (quizSlug: string) =>
    request<QuizOut>(`/api/v1/learn/quizzes/${quizSlug}`),

  submitQuiz: (quizId: string, answers: Record<string, string>) =>
    request<AttemptResult>(`/api/v1/learn/quizzes/${quizId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  progress: () =>
    request<ProgressOut>('/api/v1/learn/progress'),
}
