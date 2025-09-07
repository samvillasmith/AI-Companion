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
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {data.map((item) => (
          <Card
            key={item.id}
            className="
              group rounded-xl overflow-hidden
              bg-card hover:shadow-lg
              transition-all duration-300
              border
            "
          >
            <Link
              href={`/chat/${item.id}`}
              aria-label={`Open chat with ${item.name}`}
              className="block"
            >
              {/* Hero image */}
              <div className="relative w-full aspect-[4/3]">
                <Image
                  src={item.src}
                  alt={`${item.name} avatar`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                />
              </div>

              {/* Title + description */}
              <CardHeader className="p-4 text-center">
                <p className="text-lg font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              </CardHeader>

              {/* Meta */}
              <CardFooter className="px-4 pb-4 pt-0 flex items-center justify-between text-xs">
                <p className="lowercase text-muted-foreground">
                  @{item.userName}
                </p>
                <div className="flex items-center text-muted-foreground">
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