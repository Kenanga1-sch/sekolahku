-- Baseline Migration: Initial Schema
-- Tables based on go-backend/cmd/api/main.go and models

-- Core & Settings
CREATE TABLE IF NOT EXISTS school_settings (
    id TEXT PRIMARY KEY,
    school_name TEXT NOT NULL,
    school_npsn TEXT,
    school_address TEXT,
    school_phone TEXT,
    school_email TEXT,
    school_website TEXT,
    school_logo TEXT,
    school_lat REAL,
    school_lng REAL,
    max_distance_km REAL DEFAULT 3.0,
    spmb_is_open BOOLEAN DEFAULT 0,
    current_academic_year TEXT DEFAULT '2026/2027',
    principal_name TEXT,
    principal_nip TEXT,
    is_maintenance BOOLEAN DEFAULT 0,
    last_letter_number INTEGER DEFAULT 0,
    letter_number_format TEXT DEFAULT '421/{nomor}/SDN1/{bulan}/{tahun}',
    savings_treasurer_id TEXT,
    school_vision TEXT,
    school_mission TEXT,
    school_indicators TEXT,
    school_history_timeline TEXT,
    school_history_achievements TEXT,
    school_curriculum TEXT,
    school_extracurriculars TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    email_verified INTEGER,
    image TEXT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    full_name TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    nik TEXT,
    nisn TEXT UNIQUE,
    nis TEXT UNIQUE,
    full_name TEXT NOT NULL,
    gender TEXT,
    birth_place TEXT,
    birth_date TEXT,
    religion TEXT,
    address TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    class_name TEXT,
    class_id TEXT,
    status TEXT DEFAULT 'active',
    photo TEXT,
    qr_code TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

-- SPMB Module
CREATE TABLE IF NOT EXISTS spmb_periods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    committee_name TEXT,
    start_date INTEGER,
    end_date INTEGER,
    status TEXT DEFAULT 'draft',
    quota INTEGER DEFAULT 100,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS spmb_registrants (
    id TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    nisn TEXT,
    student_nik TEXT UNIQUE NOT NULL,
    kk_number TEXT,
    birth_certificate_no TEXT,
    birth_place TEXT,
    birth_date TEXT,
    gender TEXT,
    religion TEXT,
    special_needs TEXT,
    living_arrangement TEXT,
    transport_mode TEXT,
    child_order INTEGER,
    has_kps_pkh BOOLEAN DEFAULT 0,
    has_kip BOOLEAN DEFAULT 0,
    previous_school TEXT,
    hobby TEXT,
    ambition TEXT,
    height INTEGER,
    weight INTEGER,
    head_circumference INTEGER,
    sibling_count INTEGER,
    travel_time TEXT,
    address_street TEXT,
    address_rt TEXT,
    address_rw TEXT,
    address_village TEXT,
    postal_code TEXT,
    home_address TEXT,
    home_lat REAL,
    home_lng REAL,
    distance_km REAL,
    is_in_zone BOOLEAN DEFAULT 0,
    parent_phone TEXT,
    parent_email TEXT,
    father_name TEXT,
    father_nik TEXT,
    father_birth_year INTEGER,
    father_education TEXT,
    father_job TEXT,
    father_income TEXT,
    mother_name TEXT,
    mother_nik TEXT,
    mother_birth_year INTEGER,
    mother_education TEXT,
    mother_job TEXT,
    mother_income TEXT,
    guardian_name TEXT,
    guardian_nik TEXT,
    guardian_birth_year INTEGER,
    guardian_education TEXT,
    guardian_job TEXT,
    guardian_income TEXT,
    status TEXT DEFAULT 'draft',
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    period_id TEXT,
    verified_by TEXT,
    verified_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (period_id) REFERENCES spmb_periods(id)
);

-- Finance Module
CREATE TABLE IF NOT EXISTS finance_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_number TEXT,
    description TEXT,
    is_system BOOLEAN DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS finance_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- INCOME, EXPENSE
    description TEXT,
    is_system BOOLEAN DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    date INTEGER,
    type TEXT, -- INCOME, EXPENSE, TRANSFER
    account_id_source TEXT,
    account_id_dest TEXT,
    category_id TEXT,
    amount REAL,
    description TEXT,
    proof_image TEXT,
    status TEXT DEFAULT 'PENDING',
    ref_table TEXT,
    ref_id TEXT,
    created_by TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (account_id_source) REFERENCES finance_accounts(id),
    FOREIGN KEY (account_id_dest) REFERENCES finance_accounts(id),
    FOREIGN KEY (category_id) REFERENCES finance_categories(id)
);

-- Tabungan (Savings) Module
CREATE TABLE IF NOT EXISTS tabungan_kelas (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    wali_kelas TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (wali_kelas) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tabungan_siswa (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas_id TEXT NOT NULL,
    saldo_terakhir INTEGER DEFAULT 0,
    qr_code TEXT UNIQUE,
    foto TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (kelas_id) REFERENCES tabungan_kelas(id)
);

CREATE TABLE IF NOT EXISTS tabungan_transaksi (
    id TEXT PRIMARY KEY,
    siswa_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    setoran_id TEXT,
    tipe TEXT NOT NULL, -- SETOR, TARIK
    nominal INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    catatan TEXT,
    verified_by TEXT,
    verified_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (siswa_id) REFERENCES tabungan_siswa(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Library Module
CREATE TABLE IF NOT EXISTS library_catalog (
    id TEXT PRIMARY KEY,
    isbn TEXT,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    year INTEGER,
    category TEXT,
    description TEXT,
    cover TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS library_assets (
    id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    status TEXT DEFAULT 'AVAILABLE',
    location TEXT,
    condition TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (catalog_id) REFERENCES library_catalog(id)
);

CREATE TABLE IF NOT EXISTS library_members (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    student_id TEXT,
    name TEXT NOT NULL,
    class_name TEXT,
    qr_code TEXT UNIQUE,
    max_borrow_limit INTEGER DEFAULT 3,
    photo TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS library_loans (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    borrow_date INTEGER NOT NULL,
    due_date INTEGER NOT NULL,
    return_date INTEGER,
    is_returned BOOLEAN DEFAULT 0,
    fine_amount INTEGER DEFAULT 0,
    fine_paid BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (member_id) REFERENCES library_members(id),
    FOREIGN KEY (item_id) REFERENCES library_assets(id)
);

CREATE TABLE IF NOT EXISTS library_visits (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    timestamp INTEGER,
    guest_name TEXT,
    guest_institution TEXT,
    guest_purpose TEXT,
    created_at INTEGER,
    FOREIGN KEY (member_id) REFERENCES library_members(id)
);

-- E-Office / Letter Management
CREATE TABLE IF NOT EXISTS letter_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    content TEXT,
    file_path TEXT,
    type TEXT,
    paper_size TEXT,
    orientation TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS generated_letters (
    id TEXT PRIMARY KEY,
    letter_number TEXT,
    classification_code TEXT,
    sequence_number INTEGER,
    recipient TEXT,
    template_id TEXT,
    created_at INTEGER,
    FOREIGN KEY (template_id) REFERENCES letter_templates(id)
);

CREATE TABLE IF NOT EXISTS klasifikasi_surat (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS surat_keluar (
    id TEXT PRIMARY KEY,
    mail_number TEXT NOT NULL UNIQUE,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    date_of_letter TEXT NOT NULL,
    classification_code TEXT,
    file_path TEXT,
    final_file_path TEXT,
    status TEXT DEFAULT 'Draft' NOT NULL,
    created_by TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (classification_code) REFERENCES klasifikasi_surat(code),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS surat_masuk (
    id TEXT PRIMARY KEY,
    agenda_number TEXT NOT NULL UNIQUE,
    original_number TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    date_of_letter TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    classification_code TEXT,
    file_path TEXT NOT NULL,
    status TEXT DEFAULT 'Menunggu Disposisi' NOT NULL,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (classification_code) REFERENCES klasifikasi_surat(code)
);

CREATE TABLE IF NOT EXISTS disposisi (
    id TEXT PRIMARY KEY,
    surat_masuk_id TEXT NOT NULL,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    instruction TEXT NOT NULL,
    deadline TEXT,
    is_completed BOOLEAN DEFAULT 0 NOT NULL,
    completed_at INTEGER,
    completed_note TEXT,
    created_at INTEGER,
    FOREIGN KEY (surat_masuk_id) REFERENCES surat_masuk(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sk_number ON surat_keluar(mail_number);
CREATE INDEX IF NOT EXISTS idx_sk_date ON surat_keluar(date_of_letter);
CREATE INDEX IF NOT EXISTS idx_sk_recipient ON surat_keluar(recipient);
CREATE INDEX IF NOT EXISTS idx_sm_agenda ON surat_masuk(agenda_number);
CREATE INDEX IF NOT EXISTS idx_sm_date ON surat_masuk(received_at);
CREATE INDEX IF NOT EXISTS idx_sm_sender ON surat_masuk(sender);
CREATE INDEX IF NOT EXISTS idx_disp_surat ON disposisi(surat_masuk_id);
CREATE INDEX IF NOT EXISTS idx_disp_to_user ON disposisi(to_user_id);

-- Loans (Money)
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    employee_detail_id TEXT,
    borrower_type TEXT,
    borrower_name TEXT,
    description TEXT,
    type TEXT,
    amount_requested REAL,
    amount_approved REAL,
    tenor_months INTEGER,
    admin_fee REAL,
    status TEXT DEFAULT 'PENDING',
    rejection_reason TEXT,
    notes TEXT,
    disbursed_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_spmb_registrants_status ON spmb_registrants(status);
CREATE INDEX IF NOT EXISTS idx_spmb_registrants_reg_num ON spmb_registrants(registration_number);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions(date);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON finance_transactions(account_id_source);
CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_siswa ON tabungan_transaksi(siswa_id);
CREATE INDEX IF NOT EXISTS idx_library_loans_is_returned ON library_loans(is_returned);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- Additional Tables for Savings, Finance, Academic, and Admin Modules

CREATE TABLE IF NOT EXISTS employee_details (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nip TEXT,
    nuptk TEXT,
    nik TEXT,
    employment_status TEXT,
    job_type TEXT,
    join_date TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tabungan_brankas (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    tipe TEXT NOT NULL, -- cash, bank
    saldo INTEGER DEFAULT 0,
    pic_id TEXT,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS tabungan_brankas_transaksi (
    id TEXT PRIMARY KEY,
    tipe TEXT NOT NULL,
    nominal INTEGER NOT NULL,
    user_id TEXT,
    catatan TEXT,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tabungan_setoran (
    id TEXT PRIMARY KEY,
    guru_id TEXT NOT NULL,
    bendahara_id TEXT,
    tipe TEXT NOT NULL, -- setor_ke_bendahara, tarik_dari_bendahara
    total_nominal INTEGER NOT NULL,
    nominal_fisik INTEGER,
    selisih INTEGER,
    status TEXT DEFAULT 'pending',
    catatan TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (guru_id) REFERENCES users(id),
    FOREIGN KEY (bendahara_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tabungan_hutang (
    id TEXT PRIMARY KEY,
    siswa_id TEXT NOT NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT,
    nominal INTEGER NOT NULL,
    jumlah INTEGER DEFAULT 1,
    dicatat_oleh TEXT,
    status TEXT DEFAULT 'aktif', -- aktif, lunas
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (siswa_id) REFERENCES tabungan_siswa(id)
);

CREATE TABLE IF NOT EXISTS loan_installments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date INTEGER NOT NULL,
    principal_amount REAL,
    total_amount REAL,
    status TEXT DEFAULT 'UNPAID', -- UNPAID, PAID, LATE
    paid_at INTEGER,
    payment_method TEXT,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE TABLE IF NOT EXISTS academic_years (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    semester TEXT, -- Ganjil, Genap
    is_active BOOLEAN DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS student_classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade INTEGER,
    academic_year TEXT,
    teacher_name TEXT,
    capacity INTEGER DEFAULT 40,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS student_class_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    class_id TEXT,
    class_name TEXT,
    academic_year TEXT,
    grade INTEGER,
    status TEXT, -- promoted, graduated, failed
    record_date INTEGER,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS staff_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    degree TEXT,
    position TEXT,
    category TEXT,
    photo_url TEXT,
    nip TEXT,
    quote TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details TEXT,
    user_id TEXT,
    user_name TEXT,
    user_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT, -- INFO, SUCCESS, WARNING, ERROR
    is_read BOOLEAN DEFAULT 0,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    order_rank INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    category TEXT,
    display_order INTEGER DEFAULT 0,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT,
    excerpt TEXT,
    cover_image TEXT,
    category TEXT,
    status TEXT DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED
    view_count INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);

