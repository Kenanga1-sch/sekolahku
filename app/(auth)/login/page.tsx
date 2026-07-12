"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  GraduationCap, 
  Eye, 
  EyeOff,
  Info
} from "lucide-react";
import { loginFormSchema, type LoginFormValues } from "@/lib/validations/spmb";
import { loginAction } from "@/actions/auth";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";

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

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 60000; // 1 minute in ms

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuthStore();
  const { settings } = useSchoolSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(0);

  // Get school logo
  const schoolLogo = settings?.school_logo 
    ? (settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") 
      ? settings.school_logo 
      : `/uploads/${settings.school_logo}`) 
    : null;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
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
      const res = await loginAction(data.identity, data.password);

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
        
        // Use the returned data to determine role immediately
        const userRole = (res as any).user?.role || "user";
        
        if (userRole === "staff") {
            window.location.href = "/inventaris";
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
      className="space-y-6 w-full max-w-md mx-auto p-8 rounded-2xl bg-white/50 dark:bg-black/30 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 shadow-xl"
    >
      <div className="space-y-2 text-center flex flex-col items-center">
        {/* School Logo - Make sure it's always the school logo */}
        {schoolLogo ? (
          <img 
            src={schoolLogo} 
            alt="Logo Sekolah" 
            className="h-16 w-16 object-contain mb-2 p-1.5 bg-white rounded-xl shadow-md border"
            onError={(e) => {
              // Fallback if logo fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        {/* Fallback graduation cap icon */}
        <div className={cn(
          "h-16 w-16 flex items-center justify-center rounded-xl bg-primary text-primary-foreground mb-2 shadow-md",
          schoolLogo ? "hidden" : ""
        )}>
          <GraduationCap className="h-8 w-8" />
        </div>
        
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
        
        {isLockedOut && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Akun terkunci sementara. Silakan coba lagi dalam {timeLeft} detik.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="identity"
              render={({ field }) => (
                <FormItem id="login-identity">
                  <LabelInputContainer>
                    <FormLabel className="text-stone-600 dark:text-stone-300">Username / Email</FormLabel>
                    <FormControl>
                      <div className="relative group/btn">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-stone-400 dark:text-stone-500 z-10" />
                        <Input
                          placeholder="nama@email.com"
                          className="pl-9 h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
                          autoComplete="username"
                          disabled={isLockedOut || isLoading}
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
                <FormItem id="login-password">
                  <LabelInputContainer>
                    <FormLabel className="text-stone-600 dark:text-stone-300">Password</FormLabel>
                    <FormControl>
                      <div className="relative group/btn">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-stone-400 dark:text-stone-500 z-10" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-9 pr-10 h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
                          autoComplete="current-password"
                          disabled={isLockedOut || isLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 h-4 w-4 text-stone-400 dark:text-stone-500 z-10 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <BottomGradient />
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
                  className="text-sm text-stone-600 dark:text-stone-300 cursor-pointer select-none"
                >
                  Ingat saya
                </label>
              </div>
              
              {/* Forgot Password Link - Optional, uncomment if you have forgot password functionality */}
              {/* <Link
                href="/forgot-password"
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors"
              >
                Lupa password?
              </Link> */}
            </div>

            <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-br from-black to-neutral-600 block dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 text-white rounded-md font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset] hover:opacity-90 transition-opacity"
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

