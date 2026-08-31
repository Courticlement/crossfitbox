"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const PillarValue = z.enum(["ok", "mid", "bad"]);
const PastilleValue = z.enum(["green", "yellow", "orange", "red"]);
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const ClassReviewSchema = z.object({
  classInstanceId: z.string().min(1),
  briefingNotes: optionalText,
  generalWuNotes: optionalText,
  specificWuNotes: optionalText,
  skillWodNotes: optionalText,
  coolDownNotes: optionalText,
  pillarEnseignement: PillarValue,
  pillarObservation: PillarValue,
  pillarCorrection: PillarValue,
  pillarGestionGroupe: PillarValue,
  pillarPresenceAttitude: PillarValue,
  pillarDemonstration: PillarValue,
  identifiedText: optionalText,
  focusText: z.string().trim().min(1, "Un axe de travail est requis"),
  pastille: PastilleValue,
});

export type CreateClassReviewResult = { error?: string };

// Called directly from the wizard's client component (not a <form action>)
// since the wizard needs to hold seven steps of state before one submit —
// see ReviewWizard. Redirects into the new review's detail page on success,
// which both closes the wizard and confirms it saved.
export async function createClassReview(
  formData: FormData
): Promise<CreateClassReviewResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ClassReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { classInstanceId, ...data } = parsed.data;

  const instance = await prisma.classInstance.findUnique({
    where: { id: classInstanceId },
    select: { id: true, review: { select: { id: true } } },
  });
  if (!instance) return { error: "Ce cours n'existe plus." };
  if (instance.review) return { error: "Ce cours a déjà été reviewé." };

  const review = await prisma.classReview.create({
    data: { classInstanceId, ...data },
  });

  revalidatePath("/admin/planning");
  revalidatePath("/admin/reviews");
  redirect(`/admin/reviews/${review.id}?created=1`);
}
