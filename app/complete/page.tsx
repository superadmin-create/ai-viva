"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SuccessCheckmark } from "@/components/viva/SuccessCheckmark";
import { Confetti } from "@/components/viva/Confetti";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { stopAllVapiCalls } from "@/lib/utils/vapi-cleanup";

interface StudentFormData {
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  batchId: string;
}

export default function CompletePage() {
  const router = useRouter();
  const [studentData, setStudentData] = useState<StudentFormData | null>(null);

  useEffect(() => {
    // Stop any active Vapi calls and media streams
    console.log("[Complete Page] Stopping all Vapi calls and media streams");
    stopAllVapiCalls();

    // Get student data before clearing sessionStorage
    const storedData = sessionStorage.getItem("studentFormData");
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setStudentData(data);
      } catch {
        // Ignore parse errors
      }
    }

    // Clear all sessionStorage after reading data
    sessionStorage.clear();

    // Prevent back navigation to /viva
    // Replace the history entry so back button goes to home instead of /viva
    if (typeof window !== "undefined") {
      // Replace current history with one that points back to home
      // This prevents going back to /viva
      window.history.replaceState(
        { preventBack: true },
        "",
        window.location.href
      );
      
      // If user still tries to go back, redirect to home
      const handlePopState = () => {
        router.replace("/");
      };
      
      window.addEventListener("popstate", handlePopState);
      
      // Also intercept any attempt to navigate back
      const handleBeforeUnload = () => {
        // Ensure sessionStorage stays cleared
        sessionStorage.clear();
      };
      
      window.addEventListener("beforeunload", handleBeforeUnload);
      
      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [router]);

  const handleReturnHome = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <Confetti />
      
      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Success Checkmark */}
        <SuccessCheckmark />

        {/* Success Message */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            Viva Completed Successfully!
          </h1>
          
          {studentData && (
            <div className="space-y-2 pt-4">
              <p className="text-2xl md:text-3xl font-semibold text-gray-200">
                {studentData.fullName}
              </p>
              <p className="text-xl text-gray-400">{studentData.subject}</p>
            </div>
          )}

          <p className="text-lg md:text-xl text-gray-300 pt-4">
            Your responses have been recorded
          </p>
        </div>

        {/* Return to Home Button */}
        <div className="pt-8">
          <Button
            onClick={handleReturnHome}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 h-auto"
          >
            <Home className="w-5 h-5 mr-2" />
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
}