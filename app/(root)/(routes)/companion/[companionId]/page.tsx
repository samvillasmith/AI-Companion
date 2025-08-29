import prismadb from "../../../../../lib/prismadb";
import { CompanionForm } from "./components/companion-form";

interface CompanionIdPageProps {
    params: {
        companionId: string;
    };
};


const CompanionIdPage = async ({
    params
} : CompanionIdPageProps) => {

    // Check for premium subscription

    const companion = await prismadb.companion.findUnique({
        where: {
            id: params.companionId
        }
    })

    const categories = await prismadb.companion.findUnique({
        where: {
            id: params.companionId,
        }
    })

    return ( 
        <CompanionForm 
            initialData={companion}
            categories={categories}
        />
     );
}
 
export default CompanionIdPage;