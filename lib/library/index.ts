// ==========================================
// Library Module - Barrel Export
// ==========================================
// This file re-exports all functions from submodules
// to maintain backward compatibility with existing imports
// ==========================================

// Catalog & ISBN Lookup
export {
    downloadCoverImage,
    getOrCreateCatalog,
    bindAsset,
    swapAssetCode,
    lookupISBN,
} from "./catalog";

// Assets (Physical Items)
export {
    getLibraryAssets,
    getAssetByQRCode,
    getItemByQRCode,
    getLibraryItems,
    createLibraryItem,
    updateLibraryItem,
    deleteLibraryItem,
    getInventoryStats,
    type GetLibraryAssetsOptions,
} from "./assets";

// Members
export {
    getLibraryMembers,
    getMemberByQRCode,
    createLibraryMember,
    updateLibraryMember,
    deleteLibraryMember,
    type GetLibraryMembersOptions,
} from "./members";

// Loans
export {
    getActiveLoans,
    getOverdueLoans,
    getMemberActiveLoans,
    borrowBook,
    returnBook,
    findLoanByItemId,
} from "./loans";

// Visits
export {
    recordVisit,
    hasVisitedToday,
    getVisitReport,
} from "./visits";

// Stats & Reports
export {
    getLibraryStats,
    getLoanReport,
    getRecentActivity,
    getLoanTrend,
    getCategoryDistribution,
    getTopBorrowedBooks,
    getTopActiveMembers,
    smartScan,
    smartScanComplete,
} from "./stats";
