"use client";

import * as z from "zod";
import axios from "axios";
import { Category, Companion } from "@prisma/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner"
import { 
    Form, 
    FormField, 
    FormItem, 
    FormControl, 
    FormMessage,
    FormLabel,
    FormDescription
} from "../../../../../../components/ui/form";
import { Separator } from "../../../../../../components/ui/separator";
import { ImageUpload } from "../../../../../../components/image-upload";
import { Input } from "../../../../../../components/ui/input";
import { Button } from "../../../../../../components/ui/button";
import { 
    Select, 
    SelectTrigger, 
    SelectValue,
    SelectContent,
    SelectItem
} from "../../../../../../components/ui/select";
import { Textarea } from "../../../../../../components/ui/textarea"
import { Wand2 } from "lucide-react";

const PREAMBLE = `EXAMPLE: You are Max, a fictional character who plays the role of a highly supportive 
and energetic fitness coach, dedicated to helping the human build confidence, consistency, and joy in 
their health journey. Your tone is always positive, encouraging, and motivational, focusing on 
what the human can do rather than what they haven’t done, and you frame challenges as opportunities for 
growth instead of setbacks. You balance practical fitness knowledge—such as simple workout routines, 
stretching, recovery, and nutrition basics—with empathy and understanding, knowing that progress is not 
always linear and that rest is just as important as effort. You are there to celebrate even the smallest wins, 
reminding the human that showing up matters as much as performance, and you adapt your guidance to 
meet them where they are in energy, motivation, and mood. You are never judgmental, never discouraging, and 
always uplifting, making fitness less about perfection and more about building a balanced, sustainable 
lifestyle that strengthens both body and mind.`;  
 


const SEED_CHAT = `Human: Hey Max, I didn’t feel like working out today.  
Max: That’s okay—everyone has days like that. The important thing is you’re still showing up here.  

Human: True, but I feel guilty for skipping.  
Max: No guilt needed! Even rest days are part of progress. Want me to suggest a light stretch routine instead?  

Human: Yeah, that could work.  
Max: Great! Let’s do a 10-minute mobility flow—it’ll refresh you without draining your energy.  
`;


interface CompanionFormProps {
    initialData: Companion | null;
    categories: Category[]
}

const formSchema = z.object({
    name: z.string().min(1, {
        message: "Name is required"
    }),
    description: z.string().min(1, {
        message: "Description is required"
    }),
    instructions: z.string().min(200, {
        message: "Instructions require a minimum of 200 characters."
    }),
    seed: z.string().min(200, {
        message: "Seed requires 200 characters."
    }),
    src: z.string().min(1, {
        message: "Image is required"
    }),
    categoryId: z.string().min(1, {
        message: "Category is required"
    })
})

export const CompanionForm = ({ 
    categories, initialData }: 
    CompanionFormProps) => {

        const router = useRouter();

    
        const form = useForm<z.infer<typeof formSchema>>({
            resolver: zodResolver(formSchema),
            defaultValues: initialData || {
            name: "",
            description: "",
            instructions: "",   // ✅ add this so it's controlled
            seed: "",
            src: "",
            categoryId: undefined,
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
        if (initialData) {
            // Update the companion
            await axios.patch(`/api/companion/${initialData.id}`, values)
        } else {
            // Create the companion function
            await axios.post("/api/companion", values)
        } 
        toast("Success!", { description: "Your companion was created." });
        router.refresh();
        router.push("/");
    } catch {
        toast("Something went wrong.", { description: "Please try again." });
    }
  };

  return (
    <div className="h-full p-4 space-y-2 max-w-3xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
          <div className="space-y-2 w-full">
            <div>
              <h3 className="text-lg font-medium">General Information</h3>
              <p className="text-sm text-muted-foreground">
                General Information About Your Companion
              </p>
            </div>
            <Separator className="bg-primary/10" />
          </div>

          {/* Image */}
          <FormField
            control={form.control}
            name="src"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center justify-center space-y-4">
                <FormControl>
                  <ImageUpload
                    disabled={isLoading}
                    onChange={field.onChange}
                    value={field.value}
                  />
                </FormControl>
                <FormMessage /> {/* ✅ show src errors */}
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem className="col-span-2 md:col-span-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      placeholder="Enter Your Companion Name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This is the name that your AI companion will be called.
                  </FormDescription>
                  <FormMessage /> {/* ✅ show name errors */}
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem className="col-span-2 md:col-span-1">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading}
                      placeholder="Example: A gamer who loves Marvel Rivals & COD"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A short description for your AI companion.
                  </FormDescription>
                  <FormMessage /> {/* ✅ show description errors */}
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              name="categoryId"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue
                          defaultValue={field.value}
                          placeholder="Select a category"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select a category for your companion
                  </FormDescription>
                  <FormMessage /> {/* ✅ show category errors */}
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2 w-full">
            <div>
              <h3 className="text-lg font-medium">Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Describe your companion&apos;s backstory and personality in detail.
              </p>
            </div>
            <Separator className="bg-primary/10" />
          </div>

          {/* Instructions */}
          <FormField
            name="instructions"
            control={form.control}
            render={({ field }) => (
              <FormItem className="col-span-2 md:col-span-1">
                <FormLabel>Instructions</FormLabel>
                <FormControl>
                  <Textarea
                    className="bg-background resize-none"
                    rows={7}
                    disabled={isLoading}
                    placeholder={PREAMBLE}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Write a detailed description for your AI companion&apos;s backstory and personality
                </FormDescription>
                <FormMessage /> {/* ✅ show instructions errors */}
              </FormItem>
            )}
          />

          {/* Seed */}
          <FormField
            name="seed"
            control={form.control}
            render={({ field }) => (
              <FormItem className="col-span-2 md:col-span-1">
                <FormLabel>Example Conversation</FormLabel>
                <FormControl>
                  <Textarea
                    className="bg-background resize-none"
                    rows={7}
                    disabled={isLoading}
                    placeholder={SEED_CHAT}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  An example conversation between a human and your AI companion.
                </FormDescription>
                <FormMessage /> {/* ✅ show seed errors */}
              </FormItem>
            )}
          />

          {/* ✅ Place the submit button INSIDE the form and make it type="submit" */}
          <div className="w-full flex justify-center">
            <Button className="mb-10" size="lg" disabled={isLoading} type="submit">
              {initialData ? "Edit Your AI Companion" : "Create Your Companion"}
              <Wand2 className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};