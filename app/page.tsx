"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const STORAGE_KEY = "studentFormDraft";

const baseFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^\d+$/, "Phone number must contain only digits"),
  subject: z.string().min(1, "Please select a subject"),
});

type FormValues = z.infer<typeof baseFormSchema>;

function getSavedFormData(): Partial<FormValues> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error loading saved form data:", e);
  }
  return {};
}

function HomeContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<{ name: string; teacherEmail: string }[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get locked subject and topic from URL params
  const lockedSubject = searchParams.get("subject") || "";
  const isSubjectLocked = !!lockedSubject;

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("/api/subjects");
        const data = await response.json();
        if (data.success && data.subjects) {
          const subjectList = data.subjects.map((s: any) =>
            typeof s === "string" ? { name: s, teacherEmail: "" } : s
          );
          setSubjects(subjectList);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
        setSubjects([
          { name: "Data Structures", teacherEmail: "" },
          { name: "DBMS", teacherEmail: "" },
          { name: "Operating Systems", teacherEmail: "" },
          { name: "Computer Networks", teacherEmail: "" },
        ]);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  const [isHydrated, setIsHydrated] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      subject: lockedSubject || undefined,
    },
  });

  // Set locked values from URL on mount
  useEffect(() => {
    if (lockedSubject) {
      form.setValue("subject", lockedSubject);
      setSelectedSubject(lockedSubject);
    }
  }, [lockedSubject, form]);

  useEffect(() => {
    if (isSubjectLocked) return; // Don't load saved data if subject is locked
    const savedData = getSavedFormData();
    if (savedData.fullName) form.setValue("fullName", savedData.fullName);
    if (savedData.email) form.setValue("email", savedData.email);
    if (savedData.phone) form.setValue("phone", savedData.phone);
    if (savedData.subject && !isSubjectLocked) {
      form.setValue("subject", savedData.subject);
      setSelectedSubject(savedData.subject);
    }
    setIsHydrated(true);
  }, [form, isSubjectLocked]);

  useEffect(() => {
    if (!isHydrated) return;

    const subscription = form.watch((values) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      } catch (e) {
        console.error("Error saving form data:", e);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isHydrated]);

  const handleSubjectChange = (value: string) => {
    if (isSubjectLocked) return;
    setSelectedSubject(value);
    form.setValue("subject", value);
  };

  const onSubmit = async (data: FormValues) => {
    if (!subjects.some(s => s.name === data.subject) && !isSubjectLocked) {
      form.setError("subject", { message: "Please select a valid subject" });
      return;
    }

    setIsLoading(true);
    form.clearErrors("root");

    try {
      const verifyResponse = await fetch("/api/verify-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.verified) {
        const errorMessage =
          verifyResult.error || "Email not registered in our system";
        form.setError("root", {
          message: errorMessage,
        });
        setIsLoading(false);
        return;
      }

      const matchedSubject = subjects.find(s => s.name === data.subject);
      const formDataWithTeacher = {
        ...data,
        teacherEmail: matchedSubject?.teacherEmail || "",
      };
      sessionStorage.setItem("studentFormData", JSON.stringify(formDataWithTeacher));

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

      router.push("/verify");
    } catch (error) {
      console.error("Error submitting form:", error);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8 md:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-slate-200/50 bg-white/80 p-4 shadow-2xl shadow-slate-900/5 backdrop-blur-xl transition-all duration-300 dark:border-slate-700/50 dark:bg-slate-800/80 dark:shadow-slate-900/20 sm:rounded-2xl sm:p-6 md:p-10">
            <div className="mb-4 flex justify-center sm:mb-8">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur-xl"></div>
                <Image
                  src="/logo.png"
                  alt="LeapUp Logo"
                  width={200}
                  height={60}
                  priority
                  className="relative z-10 h-auto w-[140px] drop-shadow-lg sm:w-[200px]"
                />
              </div>
            </div>

            <div className="mb-4 text-center sm:mb-6">
              <h1 className="mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-2xl font-bold text-transparent dark:from-slate-100 dark:to-slate-300 sm:mb-3 sm:text-3xl md:text-4xl">
                Student Registration
              </h1>
              <div className="mx-auto mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left dark:border-blue-800 dark:bg-blue-950 sm:mb-4 sm:max-w-md sm:p-4">
                <ol className="list-decimal space-y-1.5 pl-4 text-xs text-blue-800 dark:text-blue-300 sm:space-y-2 sm:pl-5 sm:text-sm">
                  <li>Enter the email id that you have registered with us</li>
                  <li>Check the Spam folder if you have not received the OTP</li>
                  <li>Allow permission for microphone to proceed with the Viva</li>
                </ol>
              </div>
              <p className="text-base text-slate-600 dark:text-slate-400 sm:text-lg">
                Please fill in your details to continue
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 sm:space-y-5"
              >
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          {...field}
                          disabled={isLoading}
                          className="h-11 border-slate-300 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 sm:h-12 sm:text-base"
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
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          {...field}
                          disabled={isLoading}
                          className="h-11 border-slate-300 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 sm:h-12 sm:text-base"
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
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                        Phone
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="Enter 10-digit phone number"
                          maxLength={10}
                          {...field}
                          disabled={isLoading}
                          className="h-11 border-slate-300 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 sm:h-12 sm:text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subject Field - Locked or Dropdown */}
                {isSubjectLocked ? (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                      Subject
                    </label>
                    <div className="mt-2 flex h-11 cursor-not-allowed items-center rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 sm:h-12 sm:px-4 sm:py-3 sm:text-base">
                      {lockedSubject}
                    </div>
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                          Subject
                        </FormLabel>
                        <Select
                          onValueChange={handleSubjectChange}
                          value={field.value}
                          disabled={isLoading || isLoadingSubjects}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 border-slate-300 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 sm:h-12 sm:text-base">
                              <SelectValue
                                placeholder={
                                  isLoadingSubjects
                                    ? "Loading subjects..."
                                    : "Select a subject"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subjects.map((subjectObj) => (
                              <SelectItem key={subjectObj.name} value={subjectObj.name}>
                                {subjectObj.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.formState.errors.root && (
                  <div className="animate-in-slide rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {form.formState.errors.root.message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-blue-500/20 sm:h-12 sm:text-base"
                  disabled={isLoading || isLoadingSubjects}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-5 w-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <svg
            className="h-8 w-8 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
