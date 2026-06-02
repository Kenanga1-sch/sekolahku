// ==========================================
// Library Module - Barrel Export
// ==========================================
// This file re-exports all functions from submodules
// to maintain backward compatibility with existing imports
// ==========================================

// Catalog & ISBN Lookup
export {
    getBooks,
    createBook,
    updateBook,
    deleteBook,
    swapAssetQR,
    downloadCoverImage,
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
    syncMembersFromStudents,
    type GetMembersOptions,
} from "./members";

// Loans
export {
    getLoans,
    getActiveLoans,
    getOverdueLoans,
    borrowBook,
    returnBook,
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
} from "./stats";
