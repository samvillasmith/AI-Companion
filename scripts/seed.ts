// scripts/seed.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.category.createMany({
    data: [
      { name: "Mentors" },
      { name: "Spirituality" },
      { name: "Career" },
      { name: "Travel" },
      { name: "Friends" },
      { name: "Technology" },
      { name: "Movies & TV" },
      { name: "Music" },
      { name: "Gaming" },
      { name: "Sports" },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Seeded categories");
}

main()
  .catch((err) => {
    console.error("❌ Error seeding default categories", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
