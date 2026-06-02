// ==========================================
// Tabungan Module - Barrel Export
// ==========================================
// This file re-exports all functions from submodules
// to maintain backward compatibility with existing imports
// ==========================================

// Kelas CRUD
export {
    getKelas,
    getAllKelas,
    createKelas,
    updateKelas,
    deleteKelas,
} from "./kelas";

// Siswa CRUD
export {
    getSiswa,
    getSiswaById,
    getSiswaByQr,
    createSiswa,
    updateSiswa,
    deleteSiswa,
    getSiswaWithBalance,
} from "./siswa";

// Transaksi Logic
export {
    getTransaksi,
    getOpenTransactions,
    createTransaksi,
    getRecentTransactions,
} from "./transaksi";

// Setoran (Settlement) Logic
export {
    getSetoranList,
    getSetoranByGuru,
    createSetoran,
    verifySetoran,
    getSetoranDetail,
} from "./setoran";

// Brankas (Treasury) Logic
export {
    getBrankasStats,
    transferBrankas,
    createOrUpdateBrankas,
} from "./brankas";

// Hutang (Debts) Logic
export {
    createHutang,
    getHutangBySiswa,
    getHutangAktifBySiswa,
    getTotalHutangAktif,
    updateHutang,
    cancelHutang,
    payHutangCash,
    settleHutangFromTabungan,
    getHutangList,
} from "./hutang";

// Stats & Charts
export {
    getTabunganStats,
    getTransactionTrend,
    getSaldoByKelas,
    getTopSavers,
} from "./stats";

// Reports & Bank Statements
export {
    getStudentFinalReport,
    getStudentStatement,
    verifyStatementHash,
} from "./reports";
