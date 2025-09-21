import { checkSubscription } from "../../../../lib/subscription";
import { SubscriptionButton } from "../../../../components/subscription-button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const SettingsPage = async () => {
    const isPremium = await checkSubscription();

    return (
        <div>
            <Link 
                href="/"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Companions
            </Link>
            
            <div className="space-y-2">
                <h3 className="text-lg font-medium">Settings</h3>
                <div className="text-muted-foreground text-sm">
                    {isPremium ? "You are currently on a Premium plan." : "You are currently on a free plan."}
                </div>
            </div>
            
            <SubscriptionButton isPremium={isPremium}/>
        </div>
    );
}
 
export default SettingsPage;