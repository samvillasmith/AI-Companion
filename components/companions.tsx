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
          <Link
            key={item.id}
            href={`/chat/${item.id}`}
            className="group block focus:outline-none"
            aria-label={`Open chat with ${item.name}`}
            prefetch={false}
          >
            <Card
              className="
                rounded-2xl overflow-hidden transition
                bg-white text-black dark:bg-black dark:text-white
                border border-black/10 dark:border-white/10
                hover:border-black/20 dark:hover:border-white/20
                focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30
              "
            >
              {/* hero image */}
              <div className="relative w-full aspect-[4/3]">
                <Image
                  src={item.src}
                  alt={`${item.name} avatar`}
                  fill
                  priority={false}
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(min-width:1280px) 360px, (min-width:1024px) 33vw, (min-width:640px) 45vw, 100vw"
                />
              </div>

              {/* Title + description */}
              <CardHeader className="px-5 py-4 text-center">
                <p className="text-lg font-semibold leading-none">{item.name}</p>
                <p className="mt-2 text-xs text-black/70 dark:text-white/70 line-clamp-2">
                  {item.description}
                </p>
              </CardHeader>

              {/* Meta */}
              <CardFooter className="px-5 pb-4 pt-3 flex items-center justify-between text-xs text-black/70 dark:text-white/70 border-t border-black/5 dark:border-white/5">
                <p className="lowercase">@{item.userName}</p>
                <div className="flex items-center">
                  <MessagesSquare className="w-3 h-3 mr-1" />
                  {item._count.messages}
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
