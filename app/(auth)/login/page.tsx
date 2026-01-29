"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, ArrowRight, AlertCircle, Mail, Lock } from "lucide-react";
import { loginFormSchema, type LoginFormValues } from "@/lib/validations/spmb";
import { signIn, getSession } from "next-auth/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BottomGradient = () => {
  return (
    <>
      <span className="group-hover/btn:opacity-100 block transition duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <span className="group-hover/btn:opacity-100 blur-sm block transition duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
    </>
  );
};

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      {children}
    </div>
  );
};

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identity: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email: data.identity,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        setError("Username/email atau password salah. Silakan coba lagi.");
      } else {
        // Fetch session to determine role
        const session = await getSession();
        router.refresh(); 
        
        if (session?.user?.role === "staff") {
            router.push("/inventaris");
        } else {
            router.push("/overview");
        }
      }
    } catch (err) {
      setError("Terjadi kesalahan saat login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 w-full max-w-md mx-auto p-8 rounded-2xl bg-white/50 dark:bg-black/30 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 shadow-xl"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-800 dark:text-white">Selamat Datang</h1>
        <p className="text-muted-foreground text-sm">
          Masuk ke dashboard untuk mengelola data sekolah
        </p>
      </div>

      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="identity"
              render={({ field }) => (
                <FormItem>
                  <LabelInputContainer>
                    <FormLabel className="text-stone-600 dark:text-stone-300">Username / Email</FormLabel>
                    <FormControl>
                      <div className="relative group/btn">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-stone-400 dark:text-stone-500 z-10" />
                        <Input
                          placeholder="nama@email.com"
                          className="pl-9 h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
                          autoComplete="username"
                          {...field}
                        />
                        <BottomGradient />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </LabelInputContainer>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <LabelInputContainer>
                    <FormLabel className="text-stone-600 dark:text-stone-300">Password</FormLabel>
                    <FormControl>
                      <div className="relative group/btn">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-stone-400 dark:text-stone-500 z-10" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-9 h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
                          autoComplete="current-password"
                          {...field}
                        />
                        <BottomGradient />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </LabelInputContainer>
                </FormItem>
              )}
            />

            <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-br from-black to-neutral-600 block dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 text-white rounded-md font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset] hover:opacity-90 transition-opacity"
                disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </div>
              ) : (
                <div className="flex items-center justify-center group">
                  Masuk Sekarang
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
              <BottomGradient />
            </Button>
          </form>
        </Form>
      </div>

      <div 
        className="text-center text-sm text-muted-foreground bg-stone-50/80 dark:bg-zinc-900/50 p-4 rounded-xl border border-dashed border-stone-200 dark:border-zinc-800"
        suppressHydrationWarning={true}
      >
        <div className="font-medium text-stone-700 dark:text-stone-300">Belum punya akun?</div>
        <div className="text-xs mt-1 text-stone-500 dark:text-stone-500">
          Hubungi Administrator Sekolah untuk pembuatan akun akses sistem.
        </div>
      </div>
    </motion.div>
  );
}
