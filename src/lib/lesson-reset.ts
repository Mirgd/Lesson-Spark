// مسح كامل لحالة الدرس: المقرر، الصور، الشرائح، ورقة العمل، بنك الأسئلة، واجب الغائب.
import { clearPageImages, PRESENTATION_KEY, EXEC_PHASE_KEY } from "./presentation";
import { setLastPdfFile, FILE_ID_KEY, FILE_NAME_KEY } from "./pdf-images";
import { WORKSHEET_KEY, WORKSHEET_ANSWERS_KEY, WORKSHEET_FEEDBACK_KEY } from "./worksheet";
import { QUESTION_BANK_KEY } from "./question-bank";
import { ABSENT_HOMEWORK_KEY } from "./absent-homework";

/** المفاتيح المرتبطة بالملف المرفوع ونواتجه — تُمسح كلها مع كل ملف جديد. */
const FILE_SCOPED_KEYS = [
  "rz_curriculum",
  "rz_curriculum_name",
  FILE_ID_KEY,
  FILE_NAME_KEY,
  PRESENTATION_KEY,
  EXEC_PHASE_KEY,
  WORKSHEET_KEY,
  WORKSHEET_ANSWERS_KEY,
  WORKSHEET_FEEDBACK_KEY,
  QUESTION_BANK_KEY,
  ABSENT_HOMEWORK_KEY,
];

/**
 * يمسح كل ما يتعلق بالملف المرفوع ونواتج الذكاء الاصطناعي المبنية عليه.
 * يُستدعى عند: حذف الملف، رفع ملف بديل، وبدء درس جديد.
 */
export async function clearFileArtifacts(): Promise<void> {
  try {
    await clearPageImages();
  } catch (e) {
    console.error(e);
  }
  setLastPdfFile(null);
  if (typeof window === "undefined") return;
  for (const k of FILE_SCOPED_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      console.error(e);
    }
  }
  window.dispatchEvent(new Event("rz-presentation"));
  window.dispatchEvent(new Event("rz-worksheet"));
  window.dispatchEvent(new Event("rz-question-bank"));
  window.dispatchEvent(new Event("rz-absent-homework"));

  window.dispatchEvent(new Event("rz-pdf-file"));
  window.dispatchEvent(new Event("storage"));
}
