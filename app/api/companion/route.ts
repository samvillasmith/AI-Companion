import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "../../../lib/prismadb";
import { checkSubscription } from "../../../lib/subscription";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await currentUser();
    const { src, name, description, instructions, seed, categoryId } = body;

    // Only require a valid userId
    if (!user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!src || !name || !description || !instructions || !seed || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const isPremium = await checkSubscription();
    if (!isPremium) {
      return new NextResponse("Premium subscription required", { status: 403 });
    }

    // Robust display name
    const displayName =
      user.firstName ??
      user.username ??
      user.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
      "Anonymous";

    const companion = await prismadb.companion.create({
      data: {
        categoryId,
        userId: user.id,
        userName: displayName,   // <-- use the fallback
        src,
        name,
        description,
        instructions,
        seed,
      },
    });

    return NextResponse.json(companion);
  } catch (error) {
    console.log("[COMPANION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
