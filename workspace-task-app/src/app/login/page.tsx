import { Suspense } from "react";
import { AuthForm } from "@/components/app/AuthForm";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
