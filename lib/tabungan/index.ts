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
    getSiswaByStudentId,
    getSiswaByStudentQRCode,
    linkSiswaToStudent,
    createSiswa,
    updateSiswa,
    deleteSiswa,
    getSiswaWithBalance,
    type GetSiswaOptions,
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
    updateTransaksiInBatch,
    resubmitSetoran,
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
    getSaldoEfektif,
    updateHutang,
    cancelHutang,
    payHutangCash,
    settleHutangFromTabungan,
    getHutangList,
    createHutangBatch,
    type HutangFormData,
    type TabunganHutangWithRelations,
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
