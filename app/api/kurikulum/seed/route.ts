import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { curriculumCp } from "@/db/schema/curriculum";
import { count } from "drizzle-orm";

const OFFICIAL_CP_DATA = [
    // --- FASE A (Kelas 1-2) ---
    // BAHASA INDONESIA (A)
    { fase: "A", subject: "Bahasa Indonesia", element: "Menyimak", content: "Peserta didik mampu bersikap menjadi pendengar yang penuh perhatian. Peserta didik menunjukkan minat pada tuturan yang didengar serta mampu memahami pesan lisan dan informasi dari media audio, teks aural, instruksi lisan, dan percakapan." },
    { fase: "A", subject: "Bahasa Indonesia", element: "Membaca dan Memirsa", content: "Peserta didik mampu bersikap menjadi pembaca dan pemirsa yang menunjukkan minat terhadap teks yang dibaca atau dipirsa. Mampu membaca kata-kata yang dikenal sehari-hari dengan fasih." },
    { fase: "A", subject: "Bahasa Indonesia", element: "Berbicara dan Mempresentasikan", content: "Peserta didik mampu berbicara dengan santun tentang beragam topik yang dikenali menggunakan volume dan intonasi yang tepat sesuai konteks. Mampu bertanya tentang sesuatu, menjawab, dan menanggapi komentar orang lain." },
    { fase: "A", subject: "Bahasa Indonesia", element: "Menulis", content: "Peserta didik mampu menunjukkan keterampilan menulis permulaan dengan benar (cara memegang alat tulis, jarak mata dengan buku, menebalkan garis/huruf) di atas kertas dan/atau melalui media digital." },

    // MATEMATIKA (A)
    { fase: "A", subject: "Matematika", element: "Bilangan", content: "Peserta didik menunjukkan pemahaman dan memiliki intuisi bilangan (number sense) pada bilangan cacah sampai 100. Membaca, menulis, menentukan nilai tempat, membandingkan, mengurutkan, melakukan komposisi dan dekomposisi bilangan." },
    { fase: "A", subject: "Matematika", element: "Aljabar", content: "Peserta didik dapat menunjukan pemahaman makna simbol matematika \"=\" dalam suatu kalimat matematika yang terkait dengan penjumlahan dan pengurangan. Mengenali pola bukan bilangan (warna, bentuk)." },
    { fase: "A", subject: "Matematika", element: "Pengukuran", content: "Peserta didik dapat membandingkan panjang dan berat benda secara langsung, dan membandingkan durasi waktu. Mereka dapat mengukur dan mengestimasi panjang benda menggunakan satuan tidak baku." },
    { fase: "A", subject: "Matematika", element: "Geometri", content: "Peserta didik dapat mengenal berbagai bangun datar (segitiga, segiempat, segibanyak, lingkaran) dan bangun ruang (balok, kubus, kerucut, dan bola). Mereka dapat menyusun (komposisi) dan mengurai (dekomposisi) bangun datar." },
    { fase: "A", subject: "Matematika", element: "Analisis Data dan Peluang", content: "Peserta didik dapat mengurutkan, menyortir, mengelompokkan, membandingkan, dan menyajikan data dari banyak benda dengan menggunakan turus dan piktogram paling banyak 4 kategori." },

    // PANCASILA (A)
    { fase: "A", subject: "Pendidikan Pancasila", element: "Pancasila", content: "Peserta didik mampu mengenal dan menceritakan simbol dan sila-sila Pancasila dalam lambang negara Garuda Pancasila." },
    { fase: "A", subject: "Pendidikan Pancasila", element: "UUD RI 1945", content: "Peserta didik mampu menyebutkan aturan yang berlaku di rumah dan di sekolah, serta mendengarkan dan melaksanakan aturan tersebut." },
    { fase: "A", subject: "Pendidikan Pancasila", element: "Bhinneka Tunggal Ika", content: "Peserta didik mampu menyebutkan identitas diri, keluarga, dan teman-teman, serta menyebutkan identitas fisik dan non-fisik." },
    { fase: "A", subject: "Pendidikan Pancasila", element: "NKRI", content: "Peserta didik mampu mengenal lingkungan rumah dan sekolah serta menceritakan bentuk kerja sama membersihkan lingkungan." },

    // --- FASE B (Kelas 3-4) ---
    // BAHASA INDONESIA (B)
    { fase: "B", subject: "Bahasa Indonesia", element: "Menyimak", content: "Peserta didik mampu memahami ide pokok (gagasan) suatu pesan lisan, informasi dari media audio, teks aural (teks yang dibacakan dan/atau didengar), dan instruksi lisan yang berkaitan dengan tujuan berkomunikasi." },
    { fase: "B", subject: "Bahasa Indonesia", element: "Membaca dan Memirsa", content: "Peserta didik mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi anak dalam bentuk cetak atau elektronik. Membaca kata-kata baru dengan pola kombinasi huruf yang telah dikenal." },
    { fase: "B", subject: "Bahasa Indonesia", element: "Berbicara dan Mempresentasikan", content: "Peserta didik mampu berbicara dengan pilihan kata dan sikap tubuh/gestur yang santun, menggunakan volume dan intonasi yang tepat sesuai konteks. Mengajukan dan menanggapi pertanyaan dalam suatu percakapan." },
    { fase: "B", subject: "Bahasa Indonesia", element: "Menulis", content: "Peserta didik mampu menulis teks narasi, teks deskripsi, teks rekon, teks prosedur, dan teks eksposisi dengan rangkaian kalimat yang beragam, informasi yang rinci dan akurat dengan topik yang beragam." },

    // MATEMATIKA (B)
    { fase: "B", subject: "Matematika", element: "Bilangan", content: "Peserta didik menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 10.000. Membandingkan, mengurutkan, melakukan operasi penjumlahan dan pengurangan bilangan cacah sampai 1.000." },
    { fase: "B", subject: "Matematika", element: "Aljabar", content: "Peserta didik dapat mengisi nilai yang belum diketahui dalam sebuah kalimat matematika. Mengidentifikasi, meniru, dan mengembangkan pola gambar atau obyek sederhana dan pola bilangan membesar dan mengecil." },
    { fase: "B", subject: "Matematika", element: "Pengukuran", content: "Peserta didik dapat mengukur panjang dan berat benda menggunakan satuan baku. Peserta didik dapat mengukur luas dan volume menggunakan satuan tidak baku dan satuan baku berupa bilangan cacah." },
    { fase: "B", subject: "Matematika", element: "Geometri", content: "Peserta didik dapat mendeskripsikan ciri berbagai bentuk bangun datar (segi empat, segitiga, segi banyak). Peserta didik dapat menyusun (komposisi) dan mengurai (dekomposisi) berbagai bangun datar." },
    { fase: "B", subject: "Matematika", element: "Analisis Data dan Peluang", content: "Peserta didik dapat mengurutkan, membandingkan, menyajikan, dan menganalisis data banyak benda dan data hasil pengukuran dalam bentuk gambar, piktogram, diagram batang, dan tabel." },
    
    // PANCASILA (B)
    { fase: "B", subject: "Pendidikan Pancasila", element: "Pancasila", content: "Peserta didik memahami arti dan hubungan antarsila Pancasila, serta menerapkannya dalam kehidupan sehari-hari." },
    { fase: "B", subject: "Pendidikan Pancasila", element: "UUD RI 1945", content: "Peserta didik menyebutkan norma yang berlaku di lingkungan sekitarnya, serta menceritakan pelaksanaan hak dan kewajibannya." },
    { fase: "B", subject: "Pendidikan Pancasila", element: "Bhinneka Tunggal Ika", content: "Peserta didik mampu membedakan identitas diri dan teman, serta menghargai perbedaan fisik dan non-fisik." },
    { fase: "B", subject: "Pendidikan Pancasila", element: "NKRI", content: "Peserta didik mampu mengidentifikasi dan menjaga keutuhan lingkungan sekitar, serta berperan dalam kerja sama." },

    // IPAS (B) - IPAS only exists from Phase B
    { fase: "B", subject: "IPAS", element: "Pemahaman IPAS", content: "Peserta didik menganalisis hubungan antara bentuk serta fungsi bagian tubuh pada manusia (panca indra). Menganalisis siklus hidup makhluk hidup. Menganalisis masalah energi dan perubahannya." },
    { fase: "B", subject: "IPAS", element: "Keterampilan Proses", content: "Mengamati, mempertanyakan dan memprediksi, merencanakan dan melakukan penyelidikan, memproses, menganalisis data dan informasi, mengevaluasi dan refleksi, serta mengomunikasikan hasil." },
    
    // --- FASE C (Kelas 5-6) ---
    // BAHASA INDONESIA (C)
    { fase: "C", subject: "Bahasa Indonesia", element: "Menyimak", content: "Peserta didik mampu menganalisis informasi berupa fakta, prosedur dengan mengidentifikasikan ciri objek dan urutan proses kejadian dan nilai-nilai dari berbagai jenis teks informatif dan fiksi yang disajikan dalam bentuk lisan, teks aural dan audio." },
    { fase: "C", subject: "Bahasa Indonesia", element: "Membaca dan Memirsa", content: "Peserta didik mampu membaca kata-kata dengan berbagai pola kombinasi huruf dengan fasih dan indah serta memahami informasi dan kosakata baru yang memiliki makna denotatif, literal, konotatif, dan kiasan untuk mengidentifikasi objek, fenomena, dan karakter." },
    { fase: "C", subject: "Bahasa Indonesia", element: "Berbicara dan Mempresentasikan", content: "Peserta didik mampu menyampaikan informasi secara lisan untuk tujuan menghibur dan meyakinkan mitra tutur sesuai kaidah dan konteks. Menggunakan kosakata baru yang memiliki makna denotatif, konotatif, dan kiasan." },
    { fase: "C", subject: "Bahasa Indonesia", element: "Menulis", content: "Peserta didik mampu menulis teks eksplanasi, laporan, dan eksposisi persuasif dari gagasan, hasil pengamatan, pengalaman, dan imajinasi; menjelaskan hubungan kausalitas, serta menuangkan hasil pengamatan untuk meyakinkan pembaca." },

    // MATEMATIKA (C)
    { fase: "C", subject: "Matematika", element: "Bilangan", content: "Peserta didik dapat membaca, menulis, dan membandingkan bilangan bulat, bilangan rasional dan irasional, bilangan desimal, bilangan berpangkat bulat dan akar, bilangan dalam notasi ilmiah, serta melakukan operasinya." },
    { fase: "C", subject: "Matematika", element: "Aljabar", content: "Peserta didik dapat mencatat data, menyelesaikan masalah yang berkaitan dengan rasio dan proporsi, laju perubahan, dan persentase." },
    { fase: "C", subject: "Matematika", element: "Pengukuran", content: "Peserta didik dapat menentukan keliling dan luas berbagai bentuk bangun datar yang digabungkan, serta menghitung durasi waktu dan debit." },
    { fase: "C", subject: "Matematika", element: "Geometri", content: "Peserta didik dapat mengonstruksi dan mengurai bangun ruang (kubus, balok, dan gabungannya) dan mengenali visualisasi spasial (bagian depan, atas, dan samping)." },
    { fase: "C", subject: "Matematika", element: "Analisis Data dan Peluang", content: "Peserta didik dapat membandingkan dan menentukan modus, median, dan mean dari data tunggal untuk menyelesaikan masalah." },

    // PANCASILA (C)
    { fase: "C", subject: "Pendidikan Pancasila", element: "Pancasila", content: "Peserta didik memahami dan menyajikan hubungan antarsila dalam Pancasila sebagai suatu kesatuan yang utuh." },
    { fase: "C", subject: "Pendidikan Pancasila", element: "UUD RI 1945", content: "Peserta didik menganalisis dan menyajikan bentuk-bentuk sederhana norma, aturan, hak, dan kewajiban dalam kedudukannya sebagai peserta didik, anggota keluarga, dan bagian dari masyarakat." },
    { fase: "C", subject: "Pendidikan Pancasila", element: "Bhinneka Tunggal Ika", content: "Peserta didik menganalisis, menyajikan, dan menampilkan sikap kerja sama dalam keberagaman suku, agama, ras, dan antargolongan para pendiri bangsa." },
    { fase: "C", subject: "Pendidikan Pancasila", element: "NKRI", content: "Peserta didik mampu menganalisis masalah lingkungan hidup, serta menyajikan sikap dan perilaku menjaga keutuhan NKRI." },

    // IPAS (C)
    { fase: "C", subject: "IPAS", element: "Pemahaman IPAS", content: "Peserta didik melakukan simulasi tentang sistem organ tubuh manusia. Menyelidiki bagaimana hubungan saling ketergantungan antar komponen biotik abiotik. Menganalisis kondisi geografis." },
    { fase: "C", subject: "IPAS", element: "Keterampilan Proses", content: "Mengamati, mempertanyakan dan memprediksi, merencanakan dan melakukan penyelidikan, memproses data, mengevaluasi dan refleksi, mengomunikasikan hasil penyelidikan." },

    // --- MAPEL UMUM (CONTOH FASE A/B/C) ---
    // PAI - AL-QURAN HADIS
    { fase: "A", subject: "Pendidikan Agama Islam", element: "Al-Qur'an dan Hadis", content: "Peserta didik mengenal huruf hijaiyah dan harakatnya, huruf hijaiyah bersambung, dan mampu membaca surah-surah pendek Al-Qur'an dengan baik." },
    { fase: "B", subject: "Pendidikan Agama Islam", element: "Al-Qur'an dan Hadis", content: "Peserta didik mampu membaca surah-surah pendek atau ayat Al-Qur'an dan menjelaskan pesan pokoknya dengan baik." },
    // PAI - AKIDAH
    { fase: "A", subject: "Pendidikan Agama Islam", element: "Akidah", content: "Peserta didik mengenal rukun iman kepada Allah melalui nama-namanya yang agung (Asmaulhusna) dan mengenal para malaikat dan tugas yang diembannya." },
    // PAI - AKHLAK
    { fase: "A", subject: "Pendidikan Agama Islam", element: "Akhlak", content: "Peserta didik terbiasa mempraktikkan nilai-nilai baik dalam kehidupan sehari-hari dalam ungkapan-ungkapan positif baik untuk dirinya maupun sesama manusia." },
    // PAI - FIKIH
    { fase: "A", subject: "Pendidikan Agama Islam", element: "Fikih", content: "Peserta didik mampu mengenal rukun Islam, melafalkan kalimah syahadatain, menerapkan tata cara bersuci, salat fardu, azan, ikamah, zikir dan berdoa setelah salat." },
    // PAI - SEJARAH (SPI)
    { fase: "A", subject: "Pendidikan Agama Islam", element: "Sejarah Peradaban Islam", content: "Peserta didik mampu menceritakan secara sederhana kisah beberapa nabi yang wajib diimani, kisah Nabi Muhammad SAW dan sahabat-sahabatnya." },

    // BAHASA INGGRIS
    { fase: "A", subject: "Bahasa Inggris", element: "Menyimak - Berbicara", content: "Peserta didik menggunakan bahasa Inggris sederhana untuk berinteraksi dalam situasi sosial dan kelas." },
    { fase: "A", subject: "Bahasa Inggris", element: "Membaca - Memirsa", content: "Peserta didik merespons penggunaan bahasa Inggris secara lisan." }, // (Fase A biasanya fokus lisan, tapi ada pengenalan)
    { fase: "B", subject: "Bahasa Inggris", element: "Menyimak - Berbicara", content: "Peserta didik menggunakan bahasa Inggris untuk berinteraksi dalam lingkup situasi sosial dan kelas yang makin luas, namun masih dapat diprediksi." },
    { fase: "B", subject: "Bahasa Inggris", element: "Membaca - Memirsa", content: "Peserta didik memahami kata-kata yang sering digunakan sehari-hari dengan bantuan gambar/ilustrasi." },
    { fase: "B", subject: "Bahasa Inggris", element: "Menulis - Mempresentasikan", content: "Peserta didik mengomunikasikan ide dan pengalamannya melalui gambar dan salinan tulisan." },

    // PJOK
    { fase: "A", subject: "PJOK", element: "Terampil Bergerak", content: "Peserta didik mempraktikkan aktivitas pola gerak dasar, aktivitas senam, aktivitas gerak berirama, dan aktivitas permainan." },
    { fase: "A", subject: "PJOK", element: "Belajar Melalui Gerak", content: "Peserta didik menunjukkan perilaku bertanggung jawab dalam menyimak arahan dan umpan balik." },
    { fase: "A", subject: "PJOK", element: "Bergaya Hidup Aktif", content: "Peserta didik mengetahui perlunya melakukan aktivitas fisik sehari-hari." },
    { fase: "A", subject: "PJOK", element: "Memilih Hidup Sehat", content: "Peserta didik mengetahui bagian-bagian tubuh, cara menjaga kebersihannya, dan kebersihan pakaian." },
    
    // SENI RUPA
    { fase: "A", subject: "Seni Rupa", element: "Mengalami", content: "Peserta didik mampu mengamati, mengenal, merekam dan menuangkan pengalaman kesehariannya secara visual." },
    { fase: "A", subject: "Seni Rupa", element: "Menciptakan", content: "Peserta didik mampu menciptakan karya dengan mengeksplorasi dan menggunakan elemen seni rupa." },
    { fase: "A", subject: "Seni Rupa", element: "Merefleksikan", content: "Peserta didik mampu mengenali dan menceritakan fokus dari karya yang diciptakan atau dilihatnya." },
    { fase: "A", subject: "Seni Rupa", element: "Berpikir dan Bekerja Artistik", content: "Peserta didik mampu mengenali dan membiasakan diri dengan berbagai prosedur dasar sederhana untuk berkarya." },
    { fase: "A", subject: "Seni Rupa", element: "Berdampak", content: "Peserta didik mampu menciptakan karya sendiri yang sesuai dengan perasaan atau minatnya." },

    // --- MUATAN LOKAL ---

    // BAHASA INDRAMAYU (Fase A)
    {
        fase: "A",
        subject: "Bahasa Indramayu",
        element: "Menyimak",
        content: "Peserta didik mampu memahami instruksi lisan sederhana dalam Bahasa Indramayu (Bebasan/Krama) yang berkaitan dengan diri sendiri dan lingkungan terdekat."
    },
    {
        fase: "A",
        subject: "Bahasa Indramayu",
        element: "Berbicara",
        content: "Peserta didik mampu mengucapkan salam, bertegur sapa, dan mempekenalkan diri menggunakan Bahasa Indramayu dengan santun."
    },
    // BAHASA INDRAMAYU (Fase B)
    {
        fase: "B",
        subject: "Bahasa Indramayu",
        element: "Membaca",
        content: "Peserta didik mampu membaca teks narasi singkat atau puisi sederhana (parikan) dalam Bahasa Indramayu."
    },

    // BUDI PEKERTI (Fase A)
    {
        fase: "A", 
        subject: "Budi Pekerti",
        element: "Perilaku",
        content: "Peserta didik terbiasa bersikap sopan santun kepada orang tua dan guru, serta membiasakan kata-kata ajaib (maaf, tolong, terima kasih)."
    },
    // --- TAMBAHAN FASE B (Kelas 3-4) ---
    // PAI (B)
    { fase: "B", subject: "Pendidikan Agama Islam", element: "Al-Qur'an dan Hadis", content: "Peserta didik mampu membaca surah-surah pendek atau ayat Al-Qur'an dan menjelaskan pesan pokoknya dengan baik. Mengenal hadis tentang kewajiban menuntut ilmu." },
    { fase: "B", subject: "Pendidikan Agama Islam", element: "Akidah", content: "Peserta didik memahami sifat-sifat bagi Allah, beberapa asmaulhusna, iman kepada kitab-kitab Allah dan rasul-rasul Allah." },
    { fase: "B", subject: "Pendidikan Agama Islam", element: "Akhlak", content: "Peserta didik menghormati dan berbakti kepada orang tua dan guru, serta menyampaikan ungkapan-ungkapan positif (kalimah ṫayyibah) dalam keseharian." },
    { fase: "B", subject: "Pendidikan Agama Islam", element: "Fikih", content: "Peserta didik melaksanakan puasa, salat jumat dan salat sunah dengan baik, memahami ketentuan zakat, infak, sedekah dan hadiah." },
    { fase: "B", subject: "Pendidikan Agama Islam", element: "Sejarah Peradaban Islam", content: "Peserta didik mampu menceritakan kondisi Arab pra Islam, masa kanak-kanak dan remaja Nabi Muhammad SAW hingga diutus menjadi Rasul, dakwah periode Mekah dan Madinah." },

    // PJOK (B)
    { fase: "B", subject: "PJOK", element: "Terampil Bergerak", content: "Peserta didik mempraktikkan variasi dan kombinasi aktivitas pola gerak dasar permainan bola besar, bola kecil, dan atletik." },
    { fase: "B", subject: "PJOK", element: "Bergaya Hidup Aktif", content: "Peserta didik menunjukkan kebiasaan aktivitas fisik untuk menjaga kesehatan dan kebugaran tubuh serta daya tahan jantung." },
    
    // SENI (B)
    { fase: "B", subject: "Seni Rupa", element: "Menciptakan", content: "Peserta didik mampu menciptakan karya seni rupa dengan mengeksplorasi garis, bentuk, tekstur, dan warna." },
    { fase: "B", subject: "Seni Musik", element: "Berkarya", content: "Peserta didik mampu meniru dan memainkan pola irama sederhana menggunakan alat musik ritmis atau tubuh." },

    // --- TAMBAHAN FASE C (Kelas 5-6) ---
    // PAI (C)
    { fase: "C", subject: "Pendidikan Agama Islam", element: "Al-Qur'an dan Hadis", content: "Peserta didik mampu membaca, menghafal, menulis, dan memahami pesan pokok surah-surah pendek dan ayat Al-Qur'an tentang keragaman." },
    { fase: "C", subject: "Pendidikan Agama Islam", element: "Akidah", content: "Peserta didik memahami iman kepada hari akhir, qada dan qadar." },
    { fase: "C", subject: "Pendidikan Agama Islam", element: "Akhlak", content: "Peserta didik mengenal dialog antar agama dan kepercayaan dan menyadari peluang dan tantangan yang bisa muncul dari keragaman di Indonesia." },
    { fase: "C", subject: "Pendidikan Agama Islam", element: "Fikih", content: "Peserta didik memahami ketentuan makanan dan minuman yang halal dan haram, ketentuan zakat, kurban, dan haji." },
    { fase: "C", subject: "Pendidikan Agama Islam", element: "Sejarah Peradaban Islam", content: "Peserta didik menghayati kisah perjuangan Nabi Muhammad SAW pada periode Madinah dan Khulafaur Rasyidin." },

    // BAHASA INGGRIS (C)
    { fase: "C", subject: "Bahasa Inggris", element: "Menyimak - Berbicara", content: "Peserta didik menggunakan kalimat sederhana dalam Bahasa Inggris untuk berinteraksi dalam situasi sosial dan kelas yang lebih luas." },
    { fase: "C", subject: "Bahasa Inggris", element: "Membaca - Memirsa", content: "Peserta didik memahami kata-kata, kalimat, dan teks sangat sederhana yang sering digunakan dalam kehidupan sehari-hari." },
    { fase: "C", subject: "Bahasa Inggris", element: "Menulis - Mempresentasikan", content: "Peserta didik menghasilkan teks deskripsi dan prosedur sangat sederhana." },

    // PJOK (C)
    { fase: "C", subject: "PJOK", element: "Terampil Bergerak", content: "Peserta didik mempraktikkan modifikasi berbagai aktivitas pola gerak dasar permainan dan olahraga (sepak bola, voli, kasti, lari)." },
    { fase: "C", subject: "PJOK", element: "Memilih Hidup Sehat", content: "Peserta didik memahami bahaya merokok, minuman keras, dan narkotika, serta cara menjaga kebersihan alat reproduksi." },

    // SENI (C)
    { fase: "C", subject: "Seni Rupa", element: "Menciptakan", content: "Peserta didik mampu membuat karya seni rupa 3 dimensi (patung/kerajinan) dengan menggunakan berbagai bahan dan teknik." },
    { fase: "C", subject: "Seni Musik", element: "Berkarya", content: "Peserta didik mampu memainkan alat musik melodis sederhana dan bernyanyi dengan nada yang tepat." },

    // MUATAN LOKAL (C)
    { fase: "C", subject: "Bahasa Indramayu", element: "Membaca", content: "Peserta didik mampu memahami teks wacana budaya Indramayu (adat istiadat) dan teks aksara Jawa/Carakan." },

    // --- KODING & KECERDASAN ARTIFISIAL (KKA) ---
    // FASE A
    {
        fase: "A",
        subject: "Koding dan Kecerdasan Artifisial",
        element: "Berpikir Komputasional",
        content: "Peserta didik mampu mengenali pola sederhana dan urutan langkah-langkah (algoritma) dalam kehidupan sehari-hari melalui permainan atau aktivitas tanpa komputer (unplugged)."
    },
    // FASE B
    {
        fase: "B",
        subject: "Koding dan Kecerdasan Artifisial",
        element: "Literasi Digital",
        content: "Peserta didik mampu mengoperasikan perangkat komputer sederhana serta mengenal etika dasar dalam menggunakan teknologi informasi."
    },
    {
        fase: "B",
        subject: "Koding dan Kecerdasan Artifisial",
        element: "Algoritma dan Pemrograman",
        content: "Peserta didik mampu menyusun blok kode visual (visual blocks) secara logis untuk membuat gerakan atau animasi sederhana."
    },
    // FASE C
    {
        fase: "C",
        subject: "Koding dan Kecerdasan Artifisial",
        element: "Kecerdasan Artifisial (AI)",
        content: "Peserta didik mengenal konsep dasar kecerdasan buatan (AI), membedakan antara kecerdasan manusia dan mesin, serta memahami pemanfaatan AI dalam kehidupan sehari-hari."
    },
    {
        fase: "C",
        subject: "Koding dan Kecerdasan Artifisial",
        element: "Pemrograman Kreatif",
        content: "Peserta didik mampu mengembangkan program sederhana yang melibatkan variabel, perulangan, dan percabangan (if-else) untuk memecahkan masalah atau membuat proyek kreatif (game/cerita)."
    }
];

export async function POST(req: NextRequest) {
  try {
    // 1. Fetch existing headers to prevent duplicates
    const existingRows = await db.select({
        fase: curriculumCp.fase,
        subject: curriculumCp.subject,
        element: curriculumCp.element
    }).from(curriculumCp);
    
    // Create Set for O(1) lookup (Key: "FASE|SUBJECT|ELEMENT")
    const existingSet = new Set(existingRows.map(r => `${r.fase}|${r.subject}|${r.element}`));

    // 2. Filter new items
    const newItems = OFFICIAL_CP_DATA.filter(item => !existingSet.has(`${item.fase}|${item.subject}|${item.element}`));

    if (newItems.length === 0) {
         return NextResponse.json({ success: true, count: 0, message: "Semua data CP sudah lengkap." });
    }

    // 3. Bulk insert new items
    const values = newItems.map(item => ({
        fase: item.fase as any,
        subject: item.subject,
        element: item.element,
        content: item.content
    }));

    // Chunking insert
    const chunkSize = 50;
    for (let i = 0; i < values.length; i += chunkSize) {
        await db.insert(curriculumCp).values(values.slice(i, i + chunkSize));
    }

    return NextResponse.json({ success: true, count: values.length, message: `Berhasil menambahkan ${values.length} data CP baru.` });
  } catch (error: any) {
     console.error("Seed Error:", error);
     return NextResponse.json({ success: false, error: error.message || "Failed to seed CP" }, { status: 500 });
  }
}
