"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Loader2, 
  ArrowRight, 
  AlertCircle, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Info
} from "lucide-react";
import { loginFormSchema, type LoginFormValues } from "@/lib/validations/spmb";
import { loginAction } from "@/actions/auth";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { APP_VERSION } from "@/lib/api-client";

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

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 60000; // 1 minute in ms

export default function LoginPage() {
  const { refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: "onBlur",
    defaultValues: {
      identity: "",
      password: "",
    },
  });

  // Load saved identity from localStorage if remember me was checked
  useEffect(() => {
    const savedIdentity = localStorage.getItem("remembered_identity");
    if (savedIdentity) {
      form.setValue("identity", savedIdentity);
      setRememberMe(true);
    }
    
    // Load lockout state
    const savedLockout = localStorage.getItem("login_lockout_until");
    if (savedLockout) {
      const lockoutTime = parseInt(savedLockout);
      if (lockoutTime > Date.now()) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem("login_lockout_until");
        localStorage.removeItem("login_attempts");
      }
    }
    
    const savedAttempts = localStorage.getItem("login_attempts");
    if (savedAttempts) {
      setAttempts(parseInt(savedAttempts));
    }

    // Hasil alur Google yang dibatalkan/gagal (redirect dari backend).
    // Dibaca dari window.location agar tidak perlu useSearchParams +
    // Suspense (static export).
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "cancelled") {
      setError("Pendaftaran dengan Google dibatalkan.");
    }
  }, [form]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutUntil > Date.now()) {
      const interval = setInterval(() => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          setLockoutUntil(0);
          setAttempts(0);
          localStorage.removeItem("login_lockout_until");
          localStorage.removeItem("login_attempts");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  const handleLockout = () => {
    const newLockoutUntil = Date.now() + LOCKOUT_TIME;
    setLockoutUntil(newLockoutUntil);
    localStorage.setItem("login_lockout_until", newLockoutUntil.toString());
  };

  const onSubmit = async (data: LoginFormValues) => {
    // Check if locked out
    if (lockoutUntil > Date.now()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await loginAction(data.identity, data.password, rememberMe);

      if (res?.error) {
        // Increment failed attempts
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        localStorage.setItem("login_attempts", newAttempts.toString());
        
        if (newAttempts >= MAX_ATTEMPTS) {
          handleLockout();
          setError(`Terlalu banyak percobaan gagal. Silakan coba lagi dalam ${LOCKOUT_TIME / 1000} detik.`);
        } else {
          // Generic error message for security
          setError("Kredensial login tidak valid.");
        }
      } else {
        // Reset attempts on successful login
        setAttempts(0);
        localStorage.removeItem("login_attempts");
        localStorage.removeItem("login_lockout_until");
        
        // Handle remember me
        if (rememberMe) {
          localStorage.setItem("remembered_identity", data.identity);
        } else {
          localStorage.removeItem("remembered_identity");
        }
        
        // Sync the global auth state before redirecting
        await refreshSession();
        
        // Check if must change password
        const mustChangePassword = (res as any).mustChangePassword;
        
        // If user must change password (first login), redirect to password change page
        if (mustChangePassword) {
            window.location.href = "/profil/ganti-password";
            return;
        }
        
        // Use the returned data to determine role immediately
        const userRole = (res as any).user?.role || "user";
        
        if (userRole === "staff") {
            window.location.href = "/inventaris";
        } else if (userRole === "orangtua") {
            window.location.href = "/parent";
        } else {
            window.location.href = "/overview";
        }
      }
    } catch (err) {
      setError("Terjadi kesalahan saat login.");
    } finally {
      setIsLoading(false);
    }
  };

  const isLockedOut = lockoutUntil > Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-line/70 bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="space-y-2 text-center flex flex-col items-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Selamat Datang</h1>
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
        
        {isLockedOut && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Akun terkunci sementara. Silakan coba lagi dalam {timeLeft} detik.
            </AlertDescription>
          </Alert>
        )}

        <GoogleButton label="Masuk dengan Google" />
        <AuthDivider text="atau masuk dengan akun sekolah" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="identity"
              render={({ field }) => (
                <FormItem id="login-identity">
                  <LabelInputContainer>
                    <FormLabel className="text-foreground/80">Username / Email</FormLabel>
                    <FormControl>
                      <div className="relative group/btn">
                        <Mail className="absolute left-3 top-3.5 z-10 h-4 w-4 text-text-soft" aria-hidden="true" />
                        <Input
                          placeholder="nama@email.com"
                          className="h-11 pl-10"
                          autoComplete="username"
                          disabled={isLockedOut || isLoading}
                          {...field}
                        />
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
                <FormItem id="login-password">
                  <LabelInputContainer>
                    <FormLabel className="text-foreground/80">Password</FormLabel>
                    <FormControl>
                      <div className="relative group/btn">
                        <Lock className="absolute left-3 top-3.5 z-10 h-4 w-4 text-text-soft" aria-hidden="true" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-11 pl-10 pr-10"
                          autoComplete="current-password"
                          disabled={isLockedOut || isLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded text-text-soft transition-colors hover:text-foreground"
                          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </LabelInputContainer>
                </FormItem>
              )}
            />
            
            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={isLockedOut || isLoading}
                />
                <label
                  htmlFor="remember"
                  className="cursor-pointer select-none text-sm text-foreground/80"
                >
                  Ingat saya
                </label>
              </div>
              
              {/* Forgot Password - arahkan ke halaman bantuan */}
              <Link
                href="/lupa-password"
                className="text-sm font-medium text-primary hover:underline underline-offset-4"
              >
                Lupa password?
              </Link>
            </div>

            <Button
                type="submit"
                size="lg"
                className="h-11 w-full"
                disabled={isLockedOut || isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </div>
              ) : isLockedOut ? (
                <div className="flex items-center justify-center">
                  Tunggu {timeLeft}s...
                </div>
              ) : (
                <div className="flex items-center justify-center group">
                  Masuk Sekarang
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </form>
        </Form>
      </div>

      <div 
        className="rounded-xl border border-dashed border-line/80 bg-surface-muted/50 p-4 text-center text-sm text-muted-foreground"
        suppressHydrationWarning={true}
      >
        <div className="font-medium text-foreground">Orang tua siswa?</div>
        <div className="mt-1 text-xs text-muted-foreground">
          <a href="/daftar-ortu" className="underline font-medium text-primary">Daftar akun orang tua</a> untuk memantau kehadiran, tabungan, dan pengumuman anak.
        </div>
      </div>

      <div className="text-center">
        <span className="text-xs text-muted-foreground font-mono tracking-widest select-none">
          {APP_VERSION}
        </span>
      </div>
    </motion.div>
  );
}

