/* eslint-disable @typescript-eslint/no-explicit-any */
import { Categories } from "@/components/categories";
import { Companions } from "@/components/companions";
import { SearchInput } from "@/components/search-input";
import prismadb from "@/lib/prismadb";
import { SuccessToast } from "@/components/success-toast";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface RootPageProps {
  searchParams: Promise<{
    categoryId?: string;
    name?: string;
    upgraded?: string;
    success?: string;
  }>;
}

const RootPage = async ({ searchParams }: RootPageProps) => {
  const params = await searchParams;
  
  // Check for first-time sign-in SERVER-SIDE
  const { userId } = await auth();
  const user = await currentUser();
  
  if (userId && user) {
    // Check if this is a brand new user
    const createdAt = user.createdAt;
    const lastSignInAt = user.lastSignInAt;
    
    // If user was created within the last 5 minutes (both are already milliseconds)
    if (createdAt && lastSignInAt && Math.abs(createdAt - lastSignInAt) < 5 * 60 * 1000) {
      // Check if they've already been through first-run
      const firstRunHandled = (user.unsafeMetadata as any)?.firstRunHandled; 
      
      if (!firstRunHandled) {
        // Redirect to first-run BEFORE rendering anything
        redirect('/first-run?next=/');
      }
    }
  }
  
  const data = await prismadb.companion.findMany({
    where: {
      categoryId: params.categoryId,
      name: {
        search: params.name,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  const categories = await prismadb.category.findMany();

  return (
    <div className="h-full space-y-4">
      {params.upgraded === 'true' && params.success === 'true' && (
        <SuccessToast />
      )}
      <SearchInput />
      <Categories data={categories} />
      <Companions data={data} />
    </div>
  );
};

export default RootPage;