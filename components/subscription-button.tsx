"use client"; 

import { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner"

interface SubscriptionButtonProps {
    isPremium: boolean;
}

export const SubscriptionButton = ({
    isPremium = false
}: SubscriptionButtonProps) => {
    const [loading, setLoading] = useState(false);
    const onClick = async () => {
        try {
            setLoading(true);
            const response = await axios.get("/api/stripe");
            window.location.href = response.data.url;
        } catch (error) {
            setLoading(false);
        } 
    }
    return(
        <Button disabled={loading} onClick={onClick} size="sm" variant={isPremium ? "default": "premium"}>
        {isPremium ? "Manage Subscription" : "Upgrade"}
        {isPremium && <Sparkles className="h-4 ml-2 fill-white"/>}
    </Button>
    )  
}