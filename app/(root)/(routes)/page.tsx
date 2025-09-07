import { Categories } from "@/components/categories";
import { Companions } from "@/components/companions";
import { SearchInput } from "@/components/search-input";
import prismadb from "@/lib/prismadb";
import { SuccessToast } from "@/components/success-toast";

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