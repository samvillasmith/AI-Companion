import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prismadb from "../../../../lib/prismadb";
import { checkSubscription } from "../../../../lib/subscription";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ companionId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { companionId } = await ctx.params;

    const body = await req.json();
    const user = await currentUser();

    const { src, name, description, instructions, seed, categoryId } = body ?? {};

    if (!companionId) {
      return new NextResponse("Companion ID is required", { status: 400 });
    }

    if (!user?.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!src || !name || !description || !instructions || !seed || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const isPremium = await checkSubscription();
    if (!isPremium) {
      return new NextResponse("Premium subscription required", { status: 403 });
    }

    // Ensure ownership
    const existing = await prismadb.companion.findFirst({
      where: { id: companionId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    const companion = await prismadb.companion.update({
      where: { id: companionId, userId: user.id },
      data: {
        categoryId,
        userId: user.id,
        userName: user.firstName,
        src,
        name,
        description,
        instructions,
        seed,
      },
    });

    return NextResponse.json(companion);
  } catch (error) {
    console.error("[COMPANION_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { companionId } = await ctx.params;

    const { userId } = await auth(); // <- Changed from getAuth(req) to await auth()
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!companionId) {
      return new NextResponse("Companion ID is required", { status: 400 });
    }

    // Ensure it belongs to the caller
    const existing = await prismadb.companion.findFirst({
      where: { id: companionId, userId },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    await prismadb.companion.delete({ where: { id: companionId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[COMPANION_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}