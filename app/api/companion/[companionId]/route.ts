import { getAuth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "../../../../lib/prismadb";
import { checkSubscription } from "../../../../lib/subscription";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { companionId: string } }
) {
  try {
    const body = await req.json();
    const user = await currentUser();

    const { src, name, description, instructions, seed, categoryId } = body ?? {};

    if (!params.companionId) {
      return new NextResponse("Companion ID is required", { status: 400 });
    }

    if (!user?.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!src || !name || !description || !instructions || !seed || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const isPremium = await checkSubscription();

    if (!isPremium){
      return new NextResponse("Premium subscription required", { status: 403 })
    }

    // Ensure ownership
    const existing = await prismadb.companion.findFirst({
      where: { id: params.companionId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    const companion = await prismadb.companion.update({
      where: { id: params.companionId, userId: user.id },
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

export async function DELETE(
  req: Request,
  { params }: { params: { companionId: string } }
) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.companionId) {
      return new NextResponse("Companion ID is required", { status: 400 });
    }

    // Ensure it belongs to the caller
    const existing = await prismadb.companion.findFirst({
      where: { id: params.companionId, userId },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    await prismadb.companion.delete({ where: { id: params.companionId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[COMPANION_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
