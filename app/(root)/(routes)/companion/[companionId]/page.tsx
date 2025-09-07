import prismadb from "../../../../../lib/prismadb";
import { CompanionForm } from "./components/companion-form";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CompanionIdPageProps {
  // Next 15 async params
  params: Promise<{ companionId: string }>;
}

const CompanionIdPage = async ({ params }: CompanionIdPageProps) => {
  const { companionId } = await params;

  // Clerk auth() is async in Next 15 — await it
  const { userId: authUserId } = await auth();

  // Fall back to currentUser() if auth() is empty (e.g., dev edge cases)
  let userId = authUserId;
  if (!userId) {
    const user = await currentUser();
    userId = user?.id ?? null;
  }

  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/companion/${companionId}`)}`);
  }

  // If creating a new one, skip fetch
  const companion =
    companionId !== "new"
      ? await prismadb.companion.findUnique({
          where: { id: companionId },
        })
      : null;

  // If editing, ensure record exists and user owns it
  if (companionId !== "new") {
    if (!companion) {
      redirect("/");
    }
    if (companion.userId !== userId) {
      redirect("/");
    }
  }

  const categories = await prismadb.category.findMany();

  return <CompanionForm initialData={companion} categories={categories} />;
};

export default CompanionIdPage;
