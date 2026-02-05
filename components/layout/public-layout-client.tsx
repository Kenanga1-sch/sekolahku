import { LandingSidebar } from "@/components/layout/landing-sidebar";
import Footer from "@/components/layout/footer";
import { cn } from "@/lib/utils";

export default function PublicLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-900 w-full flex-1 mx-auto border-neutral-200 dark:border-neutral-700 overflow-hidden",
        "h-screen" // App-like stickiness
      )}
    >
      <LandingSidebar />
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
         <main className="flex-1 w-full min-h-full">
            {children}
         </main>
         <Footer />
      </div>
    </div>
  );
}
