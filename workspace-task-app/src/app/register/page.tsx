import { Suspense } from "react";
import { AuthForm } from "@/components/app/AuthForm";

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
