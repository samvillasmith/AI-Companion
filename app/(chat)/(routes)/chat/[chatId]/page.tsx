import prismadb from "../../../../../lib/prismadb";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChatClient } from "./components/client";

interface ChatIdPageProps {
  params: { chatId: string };
}

const ChatIdPage = async ({ params }: ChatIdPageProps) => {
  const { userId, redirectToSignIn } = await auth(); // <-- await

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: `/chat/${params.chatId}` });
  }

  const companion = await prismadb.companion.findUnique({
    where: { id: params.chatId },
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

  return(
    <ChatClient companion={companion} />
  );
};

export default ChatIdPage;
