// ==========================================
// Centralized Indonesian Messages & Constants
// ==========================================
// All user-facing strings in one place for consistency

export const Messages = {
    // ==========================================
    // Validation Messages
    // ==========================================
    validation: {
        required: (field: string) => `${field} wajib diisi`,
        minLength: (field: string, min: number) => `${field} minimal ${min} karakter`,
        maxLength: (field: string, max: number) => `${field} maksimal ${max} karakter`,
        invalidFormat: (field: string) => `Format ${field} tidak valid`,
        invalidEmail: "Format email tidak valid",
        invalidPhone: "Format nomor HP tidak valid (contoh: 08123456789)",
        invalidNIK: "NIK harus 16 digit angka",
        invalidNISN: "NISN harus 10 digit angka",
        passwordWeak: "Password harus mengandung huruf besar, huruf kecil, dan angka",
        passwordMismatch: "Konfirmasi password tidak sama",
        fileTooLarge: "Ukuran file maksimal 2MB",
        invalidFileType: "Format file tidak didukung",
    },

    // ==========================================
    // Auth Messages
    // ==========================================
    auth: {
        loginRequired: "Silakan login terlebih dahulu",
        loginSuccess: "Berhasil login",
        loginFailed: "Email atau password salah",
        logoutSuccess: "Berhasil logout",
        unauthorized: "Anda harus login untuk mengakses fitur ini",
        forbidden: "Anda tidak memiliki akses ke fitur ini",
        sessionExpired: "Sesi Anda telah berakhir. Silakan login kembali.",
        accountLocked: "Akun Anda dikunci. Hubungi administrator.",
        invalidToken: "Token tidak valid atau sudah kadaluarsa",
    },

    // ==========================================
    // CRUD Messages
    // ==========================================
    crud: {
        createSuccess: (item: string) => `${item} berhasil ditambahkan`,
        updateSuccess: (item: string) => `${item} berhasil diperbarui`,
        deleteSuccess: (item: string) => `${item} berhasil dihapus`,
        createFailed: (item: string) => `Gagal menambahkan ${item}`,
        updateFailed: (item: string) => `Gagal memperbarui ${item}`,
        deleteFailed: (item: string) => `Gagal menghapus ${item}`,
        notFound: (item: string) => `${item} tidak ditemukan`,
        alreadyExists: (item: string) => `${item} sudah ada`,
    },

    // ==========================================
    // Error Messages
    // ==========================================
    error: {
        internalError: "Terjadi kesalahan internal. Silakan coba lagi.",
        networkError: "Koneksi terputus. Periksa jaringan Anda.",
        rateLimited: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
        invalidRequest: "Permintaan tidak valid",
        invalidJSON: "Format data tidak valid",
        operationFailed: "Operasi gagal. Silakan coba lagi.",
        serviceUnavailable: "Layanan sedang tidak tersedia",
    },

    // ==========================================
    // SPMB Messages
    // ==========================================
    spmb: {
        registrationSuccess: "Pendaftaran berhasil! Simpan nomor pendaftaran Anda.",
        registrationFailed: "Pendaftaran gagal. Silakan coba lagi.",
        periodNotActive: "Periode pendaftaran tidak aktif",
        alreadyRegistered: "NIK sudah terdaftar sebelumnya",
        documentRequired: "Dokumen wajib harus diupload",
        quotaFull: "Kuota pendaftaran sudah penuh",
    },

    // ==========================================
    // Library Messages
    // ==========================================
    library: {
        borrowSuccess: "Buku berhasil dipinjam",
        returnSuccess: "Buku berhasil dikembalikan",
        itemNotAvailable: "Buku sedang dipinjam",
        maxBorrowReached: "Batas peminjaman sudah tercapai",
        memberNotFound: "Anggota tidak ditemukan",
        loanNotFound: "Data peminjaman tidak ditemukan",
        overdueFine: (days: number, amount: number) => 
            `Terlambat ${days} hari. Denda: Rp ${amount.toLocaleString("id-ID")}`,
    },

    // ==========================================
    // Tabungan Messages
    // ==========================================
    tabungan: {
        depositSuccess: "Setoran berhasil dicatat",
        withdrawSuccess: "Penarikan berhasil",
        insufficientBalance: "Saldo tidak mencukupi",
        verificationPending: "Menunggu verifikasi bendahara",
        verificationApproved: "Setoran telah diverifikasi",
        verificationRejected: "Setoran ditolak",
        debtPaid: "Hutang berhasil dilunasi",
    },

    // ==========================================
    // UI Labels
    // ==========================================
    ui: {
        loading: "Memuat...",
        saving: "Menyimpan...",
        processing: "Memproses...",
        confirm: "Konfirmasi",
        cancel: "Batal",
        save: "Simpan",
        edit: "Edit",
        delete: "Hapus",
        search: "Cari",
        filter: "Filter",
        export: "Ekspor",
        print: "Cetak",
        noData: "Tidak ada data",
        showMore: "Lihat lebih banyak",
        back: "Kembali",
        next: "Selanjutnya",
        previous: "Sebelumnya",
    },
} as const;

// Type helper for accessing nested messages
export type MessageKey = keyof typeof Messages;
