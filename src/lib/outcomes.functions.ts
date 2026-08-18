import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractOutcomesFromCurriculum } from "@/lib/outcomes.server";

export const extractOutcomes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      curriculum: z.string().min(1),
      topic: z.string().min(1),
      subject: z.string(),
      grade: z.string(),
      lang: z.enum(["ar", "en"]).default("ar"),
    }).parse(data),
  )
  .handler(async ({ data }) => extractOutcomesFromCurriculum(data));