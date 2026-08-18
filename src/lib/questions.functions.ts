import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildPhaseQuestions } from "@/lib/questions.server";

export const generatePhaseQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        text: z.string().min(1),
        topic: z.string(),
        subject: z.string(),
        grade: z.string(),
        lang: z.enum(["ar", "en"]).default("ar"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => buildPhaseQuestions(data));
