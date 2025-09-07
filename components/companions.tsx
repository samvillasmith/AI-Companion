import { Companion } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";

interface CompanionProps {
  data: (Companion & { _count: { messages: number } })[];
}

export const Companions = ({ data }: CompanionProps) => {
  if (data.length === 0) {
    return (
      <div className="pt-10 flex flex-col items-center justify-center space-y-3">
        <Image
          src="/empty.jpg"
          alt="Empty"
          width={300}
          height={300}
          style={{ objectFit: "cover" }}
        />
        <p className="text-lg text-muted-foreground">No Companions Found</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-visible">
      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-5 pb-10 min-w-0">
        {data.map((item) => (
          <Card
            key={item.id}
            className="
              group rounded-2xl overflow-hidden
              bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50
              border border-zinc-200 dark:border-zinc-800
              transition hover:border-zinc-300 dark:hover:border-zinc-700
              focus-within:ring-2 focus-within:ring-zinc-900/10 dark:focus-within:ring-white/20
            "
          >
            <Link
              href={`/chat/${item.id}`}
              aria-label={`Open chat with ${item.name}`}
              prefetch={false}
              className="block"
            >
              {/* hero image */}
              <div className="relative w-full aspect-[4/3]">
                <Image
                  src={item.src}
                  alt={`${item.name} avatar`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(min-width:1280px) 360px, (min-width:1024px) 33vw, (min-width:640px) 45vw, 100vw"
                />
              </div>

              {/* Title + description */}
              <CardHeader className="px-5 py-4 text-center">
                <p className="text-lg font-semibold leading-none">{item.name}</p>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                  {item.description}
                </p>
              </CardHeader>

              {/* Meta */}
              <CardFooter className="px-5 pb-4 pt-3 flex items-center justify-between text-xs border-t border-zinc-100 dark:border-white/10">
                <p className="lowercase text-zinc-600 dark:text-zinc-400">
                  @{item.userName}
                </p>
                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                  <MessagesSquare className="w-3 h-3 mr-1" />
                  {item._count.messages}
                </div>
              </CardFooter>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
};
