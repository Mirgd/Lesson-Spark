import { supabase } from "@/integrations/supabase/client";

const BUCKET = "lesson-files";

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }

  return data.user.id;
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_");
}

export async function uploadLessonPdf(planId: string, file: File): Promise<string> {
  const userId = await requireUserId();

  const fileName = safeFileName(file.name || "curriculum.pdf");

  const path = `${userId}/${planId}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });

  if (error) {
    throw error;
  }

  return path;
}

export async function downloadLessonPdf(path: string): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);

  if (error) {
    throw error;
  }

  const fileName = path.split("/").pop() || "curriculum.pdf";

  return new File([data], fileName, {
    type: data.type || "application/pdf",
  });
}

export async function removeLessonPdf(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}
