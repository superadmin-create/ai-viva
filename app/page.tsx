"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { subjects } from "@/lib/config/subjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

const formSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^\d+$/, "Phone number must contain only digits"),
  subject: z
    .string()
    .min(1, "Please select a subject")
    .refine((val) => subjects.includes(val as (typeof subjects)[number]), {
      message: "Please select a valid subject",
    }),
  batchId: z.string().min(1, "Batch/Course ID is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      subject: undefined,
      batchId: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    form.clearErrors("root");

    try {
      // Step 1: Verify student with Edmingle LMS
      const verifyResponse = await fetch("/api/verify-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          batchId: data.batchId,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.verified) {
        // Student not found in LMS
        const errorMessage =
          verifyResult.error || "Email not registered in our system";
        form.setError("root", {
          message: errorMessage,
        });
        setIsLoading(false);
        return;
      }

      // Step 2: Student verified, store form data in sessionStorage
      sessionStorage.setItem("studentFormData", JSON.stringify(data));

      // Step 3: Send OTP
      const otpResponse = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!otpResponse.ok) {
        const otpError = await otpResponse.json();
        throw new Error(otpError.error || "Failed to send OTP");
      }

      // Redirect to verify page on success
      router.push("/verify");
    } catch (error) {
      console.error("Error submitting form:", error);
      
      // Check if it's a student verification error (already handled above)
      if (error instanceof Error && error.message.includes("not registered")) {
        form.setError("root", {
          message: error.message,
        });
      } else {
        form.setError("root", {
          message: "Failed to send OTP. Please try again.",
        });
      }
      
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg shadow-sm p-6 md:p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="LeapUp Logo"
              width={200}
              height={60}
              priority
              className="h-auto"
            />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Student Registration
            </h1>
            <p className="text-muted-foreground">
              Please fill in your details to continue
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="Enter 10-digit phone number"
                        maxLength={10}
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="batchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch/Course ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your batch or course ID"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div className="text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Submitting..." : "Continue"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
