import { NuggiLogo } from "@/components/icons";
import { LoginForm } from "@/components/login/LoginForm";
import { de } from "@/i18n/de";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-[max(3rem,var(--safe-top))]">
      <div className="flex flex-1 flex-col justify-center gap-8 animate-fade-up">
        <div className="flex flex-col items-center gap-4 text-center">
          <NuggiLogo size={72} />
          <h1 className="text-3xl font-bold tracking-tight">{de.login.title}</h1>
          <p className="text-muted">{de.login.subtitle}</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted">{de.login.hint}</p>
      </div>
      <p className="mt-8 text-center text-xs text-muted/70">{de.app.disclaimer}</p>
    </main>
  );
}
