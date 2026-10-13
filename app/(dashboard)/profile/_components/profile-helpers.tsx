import { Globe, Save, User, AlertCircle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function getActionIcon(action: string) {
    switch (action.toUpperCase()) {
        case "LOGIN":
            return <Globe className="h-4 w-4" />;
        case "LOGOUT":
            return <Globe className="h-4 w-4 opacity-70" />;
        case "CREATE":
            return <Save className="h-4 w-4" />;
        case "UPDATE":
            return <User className="h-4 w-4" />;
        case "DELETE":
            return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
            return <Activity className="h-4 w-4" />;
    }
}

export function getFriendlyActionBadge(action: string) {
    switch (action.toUpperCase()) {
        case "LOGIN":
            return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200">LOGIN</Badge>;
        case "UPDATE":
            return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200">UPDATE</Badge>;
        case "DELETE":
            return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200">DELETE</Badge>;
        case "CREATE":
            return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200">CREATE</Badge>;
        default:
            return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{action}</Badge>;
    }
}
