"use client";

import { Category } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import qs from "query-string";
import { cn } from "../lib/utils";

interface CategoriesProps { data: Category[]; }

export const Categories = ({ data }: CategoriesProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId");

  const onClick = (id: string | undefined) => {
    const query = { categoryId: id };
    const url = qs.stringifyUrl({ url: window.location.href, query }, { skipNull: true });
    router.push(url);
  };

  const base = "flex items-center text-center text-xs md:text-sm px-3 md:px-4 py-2 md:py-3 rounded-md transition border";

  const Chip = ({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        base,
        "bg-muted text-foreground border-border hover:bg-muted/80",
        active && "bg-background",
        active &&
          "shadow-[0_0_0_1px_rgba(99,102,241,0.35)] dark:shadow-none",
      )}
    >
      <span
        className={cn(
          active
            ? "bg-gradient-to-r from-sky-600 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-sky-300 dark:via-indigo-300 dark:to-fuchsia-300"
            : ""
        )}
      >
        {children}
      </span>
    </button>
  );

  return (
    <div className="w-full overflow-x-auto space-x-2 flex p-1">
      <Chip active={!categoryId} onClick={() => onClick(undefined)}>All</Chip>
      {data.map((item) => (
        <Chip key={item.id} active={item.id === categoryId} onClick={() => onClick(item.id)}>
          {item.name}
        </Chip>
      ))}
    </div>
  );
};
