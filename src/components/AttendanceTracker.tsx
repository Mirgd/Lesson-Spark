import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUiLanguage } from "@/lib/ui-language";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";

type Student = {
  id: string;
  full_name: string;
};

type AttendanceStatus = "unmarked" | "present" | "absent" | "late" | "excused";

type UnderstandingLevel = "" | "mastered" | "good" | "needs_support" | "not_mastered";

type StudentAttendance = {
  studentId: string;
  status: AttendanceStatus;
  understandingLevel: UnderstandingLevel;
  feedback: string;
};

type AttendanceTrackerProps = {
  lessonPlanId: string;
  classId?: string | null;
};

export function AttendanceTracker({ lessonPlanId, classId }: AttendanceTrackerProps) {
  const { language } = useUiLanguage();
  const isArabic = language === "ar";

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, StudentAttendance>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ==========================================
     LOAD STUDENTS + ATTENDANCE
  ========================================== */

  useEffect(() => {
    if (!classId || !lessonPlanId) {
      setStudents([]);
      setAttendance({});
      return;
    }

    const loadAttendance = async () => {
      setLoading(true);

      try {
        /*
         * تحميل طالبات الفصل المختار.
         */
        const { data: studentsData, error: studentsError } = await (supabase as any)
          .from("students")
          .select("id, full_name")
          .eq("class_id", classId)
          .eq("active", true)
          .order("full_name", { ascending: true });

        if (studentsError) {
          throw studentsError;
        }

        const loadedStudents = (studentsData ?? []) as Student[];

        setStudents(loadedStudents);

        /*
         * تحميل الحضور المحفوظ لهذه الحصة.
         */
        const { data: attendanceData, error: attendanceError } = await (supabase as any)
          .from("lesson_attendance")
          .select("student_id, status, understanding_level, feedback")
          .eq("lesson_plan_id", lessonPlanId);

        if (attendanceError) {
          throw attendanceError;
        }

        const existing = new Map<
          string,
          {
            status?: AttendanceStatus;
            understanding_level?: UnderstandingLevel | null;
            feedback?: string | null;
          }
        >();

        for (const item of attendanceData ?? []) {
          existing.set(item.student_id, item);
        }

        const initialAttendance: Record<string, StudentAttendance> = {};

        for (const student of loadedStudents) {
          const saved = existing.get(student.id);

          initialAttendance[student.id] = {
            studentId: student.id,
            status: saved?.status ?? "unmarked",
            understandingLevel: saved?.understanding_level ?? "",
            feedback: saved?.feedback ?? "",
          };
        }

        setAttendance(initialAttendance);
      } catch (error) {
        console.error("LOAD ATTENDANCE ERROR:", error);

        toast.error(isArabic ? "تعذّر تحميل قائمة الطالبات" : "Unable to load students");
      } finally {
        setLoading(false);
      }
    };

    void loadAttendance();
  }, [classId, lessonPlanId, isArabic]);

  /* ==========================================
     UPDATE ONE STUDENT
  ========================================== */

  const updateStudent = (studentId: string, patch: Partial<StudentAttendance>) => {
    setAttendance((current) => ({
      ...current,

      [studentId]: {
        ...current[studentId],
        studentId,
        ...patch,
      },
    }));
  };

  /* ==========================================
     MARK ALL PRESENT
  ========================================== */

  const markAllPresent = () => {
    setAttendance((current) => {
      const next = { ...current };

      for (const student of students) {
        next[student.id] = {
          ...next[student.id],
          studentId: student.id,
          status: "present",
        };
      }

      return next;
    });
  };

  /* ==========================================
     SAVE
  ========================================== */

  const saveAttendance = async () => {
    if (!lessonPlanId || !classId) return;

    try {
      setSaving(true);

      const records = students.map((student) => {
        const item = attendance[student.id];

        return {
          lesson_plan_id: lessonPlanId,
          student_id: student.id,

          status: item?.status ?? "unmarked",

          understanding_level: item?.understandingLevel || null,

          feedback: item?.feedback?.trim() || null,

          updated_at: new Date().toISOString(),
        };
      });

      if (records.length === 0) {
        toast.error(
          isArabic ? "لا توجد طالبات في هذا الفصل" : "There are no students in this class",
        );

        return;
      }

      const { error } = await (supabase as any).from("lesson_attendance").upsert(records, {
        onConflict: "lesson_plan_id,student_id",
      });

      if (error) throw error;

      toast.success(isArabic ? "تم حفظ الحضور والمتابعة" : "Attendance and feedback saved");
    } catch (error) {
      console.error("SAVE ATTENDANCE ERROR:", error);

      toast.error(isArabic ? "تعذّر حفظ الحضور والمتابعة" : "Unable to save attendance");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================
     NO CLASS
  ========================================== */

  if (!classId) {
    return (
      <div className="rounded-2xl border bg-muted/30 p-6 text-center">
        <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />

        <p className="font-bold">{isArabic ? "اختاري الفصل أولاً" : "Select a class first"}</p>

        <p className="mt-1 text-sm text-muted-foreground">
          {isArabic
            ? "ستظهر قائمة الطالبات هنا بعد اختيار الفصل."
            : "Students will appear here after selecting a class."}
        </p>
      </div>
    );
  }

  /* ==========================================
     LOADING
  ========================================== */

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  /* ==========================================
     EMPTY CLASS
  ========================================== */

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border bg-muted/30 p-6 text-center">
        <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />

        <p className="font-bold">
          {isArabic
            ? "لا توجد طالبات مسجلات في هذا الفصل"
            : "No students are registered in this class"}
        </p>
      </div>
    );
  }

  /* ==========================================
     UI
  ========================================== */

  return (
    <section className="rounded-2xl border bg-background p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-primary">
            {isArabic ? "الحضور والمتابعة" : "Attendance & Feedback"}
          </h2>

          <p className="text-sm text-muted-foreground">
            {isArabic ? `${students.length} طالبة` : `${students.length} students`}
          </p>
        </div>

        <button
          type="button"
          onClick={markAllPresent}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-bold hover:bg-accent"
        >
          {isArabic ? "✓ تحديد الكل حاضرات" : "✓ Mark All Present"}
        </button>
      </div>

      <div className="space-y-3">
        {students.map((student, index) => {
          const item = attendance[student.id];

          return (
            <div key={student.id} className="rounded-xl border p-3">
              <div className="mb-3 font-bold">
                {index + 1}. {student.full_name}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {/* ATTENDANCE */}

                <div>
                  <label className="mb-1 block text-xs font-bold">
                    {isArabic ? "الحضور" : "Attendance"}
                  </label>

                  <select
                    value={item?.status ?? "unmarked"}
                    onChange={(e) =>
                      updateStudent(student.id, {
                        status: e.target.value as AttendanceStatus,
                      })
                    }
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  >
                    <option value="unmarked">{isArabic ? "لم يحدد" : "Not marked"}</option>

                    <option value="present">{isArabic ? "حاضرة" : "Present"}</option>

                    <option value="absent">{isArabic ? "غائبة" : "Absent"}</option>

                    <option value="late">{isArabic ? "متأخرة" : "Late"}</option>

                    <option value="excused">{isArabic ? "غياب بعذر" : "Excused"}</option>
                  </select>
                </div>

                {/* UNDERSTANDING */}

                <div>
                  <label className="mb-1 block text-xs font-bold">
                    {isArabic ? "مستوى الفهم" : "Understanding"}
                  </label>

                  <select
                    value={item?.understandingLevel ?? ""}
                    onChange={(e) =>
                      updateStudent(student.id, {
                        understandingLevel: e.target.value as UnderstandingLevel,
                      })
                    }
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  >
                    <option value="">{isArabic ? "غير محدد" : "Not selected"}</option>

                    <option value="mastered">{isArabic ? "متمكنة" : "Mastered"}</option>

                    <option value="good">{isArabic ? "جيدة" : "Good"}</option>

                    <option value="needs_support">
                      {isArabic ? "تحتاج دعم" : "Needs Support"}
                    </option>

                    <option value="not_mastered">{isArabic ? "غير متمكنة" : "Not Mastered"}</option>
                  </select>
                </div>

                {/* FEEDBACK */}

                <div>
                  <label className="mb-1 block text-xs font-bold">
                    {isArabic ? "التغذية الراجعة" : "Feedback"}
                  </label>

                  <input
                    value={item?.feedback ?? ""}
                    onChange={(e) =>
                      updateStudent(student.id, {
                        feedback: e.target.value,
                      })
                    }
                    placeholder={isArabic ? "ملاحظة قصيرة..." : "Short note..."}
                    className="w-full rounded-lg border bg-background px-3 py-2"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveAttendance()}
          className="rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving
            ? isArabic
              ? "جارٍ الحفظ..."
              : "Saving..."
            : isArabic
              ? "حفظ الحضور والمتابعة"
              : "Save Attendance"}
        </button>
      </div>
    </section>
  );
}
