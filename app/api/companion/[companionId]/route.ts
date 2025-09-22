/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/companion/[companionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser, auth } from "@clerk/nextjs/server";
import prismadb from "../../../../lib/prismadb";
import { checkSubscription } from "../../../../lib/subscription";

// Optional helper if you added it
const getDisplayName = (user: any) =>
  user?.firstName ??
  user?.username ??
  user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
  "Anonymous";

export const dynamic = "force-dynamic";

// NOTE: params is a Promise per Next 15.5.2 validator
type Ctx = { params: Promise<{ companionId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { companionId } = await ctx.params;  // <-- await the Promise

    const body = await req.json();
    const user = await currentUser();
    const { src, name, description, instructions, seed, categoryId } = body ?? {};

    if (!companionId) {
      return new NextResponse("Companion ID is required", { status: 400 });
    }

    // Only require a valid authenticated userId (do NOT require firstName)
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

    // Ensure ownership
    const existing = await prismadb.companion.findFirst({
      where: { id: companionId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    const displayName = getDisplayName(user);

    const companion = await prismadb.companion.update({
      where: { id: companionId, userId: user.id },
      data: {
        categoryId,
        userId: user.id,
        userName: displayName,   // <-- no firstName assumption
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

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { companionId } = await ctx.params;  // <-- await the Promise

    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!companionId) {
      return new NextResponse("Companion ID is required", { status: 400 });
    }

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
