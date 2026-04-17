// ==========================================
// Feature Flags System
// ==========================================
// Simple feature toggle system for gradual rollouts

type FeatureName = keyof typeof FEATURES;

interface FeatureConfig {
    enabled: boolean;
    description: string;
    rolloutPercentage?: number;  // 0-100, for gradual rollout
    enabledForRoles?: string[];  // Enable only for specific roles
    enabledForUsers?: string[];  // Enable only for specific user IDs
}

// ==========================================
// Feature Definitions
// ==========================================

const FEATURES = {
    // UI Features
    DARK_MODE: {
        enabled: true,
        description: "Dark mode theme support",
    },
    NEW_DASHBOARD: {
        enabled: false,
        description: "New redesigned dashboard",
        rolloutPercentage: 0,
    },
    
    // SPMB Features
    SPMB_ONLINE_PAYMENT: {
        enabled: false,
        description: "Online payment for SPMB",
    },
    SPMB_DOCUMENT_VERIFICATION: {
        enabled: true,
        description: "Automatic document verification",
    },
    
    // Library Features
    LIBRARY_SELF_CHECKOUT: {
        enabled: false,
        description: "Self-service book checkout",
    },
    LIBRARY_OVERDUE_NOTIFICATIONS: {
        enabled: true,
        description: "Email notifications for overdue books",
    },
    
    // Tabungan Features
    TABUNGAN_QR_SCAN: {
        enabled: true,
        description: "QR code scanning for transactions",
    },
    TABUNGAN_PARENT_APP: {
        enabled: false,
        description: "Parent mobile app integration",
    },
    
    // Admin Features
    ADMIN_BULK_OPERATIONS: {
        enabled: true,
        description: "Bulk data operations",
    },
    ADMIN_ADVANCED_REPORTS: {
        enabled: true,
        description: "Advanced reporting features",
    },
    
    // Experimental
    AI_RECOMMENDATIONS: {
        enabled: false,
        description: "AI-powered book recommendations",
        enabledForRoles: ["super_admin"],
    },
} as const satisfies Record<string, FeatureConfig>;

// ==========================================
// Feature Flag Functions
// ==========================================

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
    feature: FeatureName,
    context?: {
        userId?: string;
        userRole?: string;
    }
): boolean {
    const config = FEATURES[feature] as FeatureConfig;
    
    if (!config.enabled) {
        return false;
    }
    
    // Check role-based access
    if (config.enabledForRoles && context?.userRole) {
        if (!config.enabledForRoles.includes(context.userRole)) {
            return false;
        }
    }
    
    // Check user-specific access
    if (config.enabledForUsers && context?.userId) {
        if (!config.enabledForUsers.includes(context.userId)) {
            return false;
        }
    }
    
    // Check rollout percentage
    if (config.rolloutPercentage !== undefined && context?.userId) {
        const hash = simpleHash(context.userId + feature);
        const percentage = hash % 100;
        if (percentage >= config.rolloutPercentage) {
            return false;
        }
    }
    
    return true;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(context?: {
    userId?: string;
    userRole?: string;
}): FeatureName[] {
    return (Object.keys(FEATURES) as FeatureName[]).filter(
        (feature) => isFeatureEnabled(feature, context)
    );
}

/**
 * Get feature configuration
 */
export function getFeatureConfig(feature: FeatureName): FeatureConfig {
    return FEATURES[feature];
}

/**
 * Get all feature configurations (for admin UI)
 */
export function getAllFeatures(): Record<FeatureName, FeatureConfig> {
    return { ...FEATURES };
}

// ==========================================
// Helpers
// ==========================================

/**
 * Simple hash function for consistent rollout
 */
function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// ==========================================
// React Hook (Client Side)
// ==========================================

/**
 * Usage in React components:
 * 
 * import { useFeature } from "@/lib/feature-flags";
 * 
 * function MyComponent() {
 *     const isNewDashboard = useFeature("NEW_DASHBOARD");
 *     
 *     if (isNewDashboard) {
 *         return <NewDashboard />;
 *     }
 *     return <OldDashboard />;
 * }
 */

// Re-export types
export type { FeatureName, FeatureConfig };

export async function useFeature(...args: any[]) {
  console.warn("useFeature: Not yet wired to Go API");
  return { success: false, error: "Not implemented" };
}
