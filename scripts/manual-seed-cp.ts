
import { db } from "@/db";
import { curriculumCp } from "@/db/schema/curriculum";

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
];

async function seed() {
    console.log("Starting seed...");
    try {
        await db.delete(curriculumCp);
        console.log("Deleted old data.");
        
        await db.insert(curriculumCp).values(OFFICIAL_CP_DATA as any);
        console.log("Inserted new data.");
    } catch (e) {
        console.error("Seed failed:", e);
    }
}

seed();
