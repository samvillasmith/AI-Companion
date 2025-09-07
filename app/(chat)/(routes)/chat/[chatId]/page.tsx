import prismadb from "../../../../../lib/prismadb";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChatClient } from "./components/client";

export default async function ChatIdPage(
  context: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await context.params; // <-- important

  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: `/chat/${chatId}` });
  }

  const companion = await prismadb.companion.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        where: { userId },
      },
      _count: { select: { messages: true } },
    },
  });

  if (!companion) {
    redirect("/");
  }

  if (companion.seed && /^["'].*["']$/.test(companion.seed)) {
    companion.seed = companion.seed.replace(/^["']|["']$/g, "");
  }

  return <ChatClient companion={companion} />;
}
