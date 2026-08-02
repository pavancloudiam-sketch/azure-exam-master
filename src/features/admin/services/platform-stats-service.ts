import { supabase } from "@/integrations/supabase/client";

export type PlatformStats = {
  certifications: number;
  exams: number;
  publishedExams: number;
  questions: number;
  students: number;
  attempts: number;
};

async function countOf(
  table: "certifications" | "exams" | "questions" | "profiles" | "attempts",
  apply?: (query: ReturnType<typeof supabase.from>) => unknown,
): Promise<number> {
  void apply;
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Aggregate counts for the administrator overview. Reads are RLS-scoped to admins. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [certifications, exams, questions, students, attempts] = await Promise.all([
    countOf("certifications"),
    countOf("exams"),
    countOf("questions"),
    countOf("profiles"),
    countOf("attempts"),
  ]);

  const { count: publishedExams } = await supabase
    .from("exams")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);

  return {
    certifications,
    exams,
    publishedExams: publishedExams ?? 0,
    questions,
    students,
    attempts,
  };
}

export type StudentRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  isAdmin: boolean;
};

/** Registered accounts with their platform role, for the admin Students page. */
export async function listStudents(limit = 200): Promise<StudentRow[]> {
  const [{ data: profiles, error }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
  ]);
  if (error) throw error;
  const admins = new Set((roles ?? []).map((row) => row.user_id));
  return (profiles ?? []).map((profile) => ({
    ...profile,
    isAdmin: admins.has(profile.id),
  }));
}
