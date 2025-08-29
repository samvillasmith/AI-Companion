import prismadb from "../../../../../lib/prismadb";
import { CompanionForm } from "./components/companion-form";

interface CompanionIdPageProps {
    params: Promise<{
        companionId: string;
    }>;
};

const CompanionIdPage = async ({
    params
}: CompanionIdPageProps) => {

    // Await params before accessing its properties (Next.js 15 requirement)
    const { companionId } = await params;

    // Check for premium subscription

    // Fetch companion data only if editing (not creating new)
    const companion = companionId !== "new" 
        ? await prismadb.companion.findUnique({
            where: {
                id: companionId
            }
        })
        : null;

    const categories = await prismadb.category.findMany();

    return ( 
        <CompanionForm 
            initialData={companion}
            categories={categories}
        />
    );
}
 
export default CompanionIdPage;