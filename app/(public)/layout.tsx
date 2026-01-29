import PublicLayoutClient from "@/components/layout/public-layout-client";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayoutClient>{children}</PublicLayoutClient>;
}
