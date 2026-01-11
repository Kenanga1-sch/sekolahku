import { LucideIcon, FileQuestion, Inbox, Search, Image, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    variant?: "default" | "search" | "data" | "image";
}

const variantIcons: Record<string, LucideIcon> = {
    default: Inbox,
    search: Search,
    data: FileQuestion,
    image: Image,
};

export function EmptyState({
    icon,
    title,
    description,
    action,
    variant = "default",
}: EmptyStateProps) {
    const Icon = icon || variantIcons[variant];

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <Icon className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            {description && (
                <p className="text-muted-foreground max-w-md mb-6">{description}</p>
            )}
            {action && (
                action.href ? (
                    <Link href={action.href}>
                        <Button>{action.label}</Button>
                    </Link>
                ) : (
                    <Button onClick={action.onClick}>{action.label}</Button>
                )
            )}
        </div>
    );
}

// Preset empty states
export function NoDataFound({ message }: { message?: string }) {
    return (
        <EmptyState
            variant="data"
            title="Tidak Ada Data"
            description={message || "Belum ada data yang tersedia saat ini."}
        />
    );
}

export function NoSearchResults({ query }: { query?: string }) {
    return (
        <EmptyState
            variant="search"
            title="Tidak Ditemukan"
            description={query
                ? `Tidak ada hasil untuk "${query}". Coba kata kunci lain.`
                : "Tidak ada hasil yang cocok dengan pencarian Anda."
            }
        />
    );
}

export function NoArticles() {
    return (
        <EmptyState
            icon={FileQuestion}
            title="Belum Ada Berita"
            description="Berita dan pengumuman akan ditampilkan di sini."
        />
    );
}

export function NoRegistrants() {
    return (
        <EmptyState
            icon={Users}
            title="Belum Ada Pendaftar"
            description="Data pendaftar SPMB akan muncul setelah ada pendaftaran."
        />
    );
}
