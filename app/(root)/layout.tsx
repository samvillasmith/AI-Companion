// app/(root)/layout.tsx
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { checkSubscription } from "@/lib/subscription";
import { auth } from "@clerk/nextjs/server";

const RootLayout = async ({
    children
}: {
    children: React.ReactNode
}) => {
    // Check if user is authenticated first
    const { userId } = await auth();
    
    // Only check subscription if user is logged in
    const isPremium = userId ? await checkSubscription() : false;

    return ( 
        <div className="h-full">
            <Navbar isPremium={isPremium}/>
            <div className="hidden md:flex mt-16 w-20 flex-col fixed inset-y-0">
                <Sidebar isPremium={isPremium} />
            </div>
            <main className="md:pl-20 pt-16 h-full">
                {children}
            </main>
        </div>
     );
}
 
export default RootLayout;