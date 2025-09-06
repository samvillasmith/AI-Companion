// app/(root)/(routes)/page.tsx
import { Categories } from "@/components/categories";
import { Companions } from "@/components/companions";
import { SearchInput } from "@/components/search-input";
import prismadb from "@/lib/prismadb";

interface RootPageProps {
  searchParams: Promise<{
    categoryId?: string;
    name?: string;
  }>;
}

const RootPage = async ({ searchParams }: RootPageProps) => {
  // Await searchParams before using it
  const params = await searchParams;
  
  const data = await prismadb.companion.findMany({
    where: {
      categoryId: params.categoryId,
      name: {
        search: params.name
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      _count: {
        select: {
          messages: true
        }
      }
    }
  });

  const categories = await prismadb.category.findMany();

  return (
    <div className="h-full p-4 space-y-2">
      <SearchInput />
      <Categories data={categories} />
      <Companions data={data} />
    </div>
  );
};

export default RootPage;