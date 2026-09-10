import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { siteConfig } from "@/lib/config";

/**
 * Kop surat untuk dokumen @react-pdf (PDF asli, bukan window.print).
 *
 * HTML KopSurat (components/reports/kop-surat.tsx) tidak bisa dipakai di
 * dalam <Page> @react-pdf karena memakai class Tailwind. Sebelum komponen
 * ini, YearEndReportPDF menuliskan nama dan alamat sekolah lain secara
 * hardcode — dokumen resmi pencairan tabungan mencantumkan identitas yang
 * bukan milik sekolah ini.
 */

export interface KopSuratPDFProps {
    schoolName?: string | null;
    governanceName?: string | null;
    schoolAddress?: string | null;
    schoolNpsn?: string | null;
    schoolPhone?: string | null;
    schoolLogo?: string | null;
    /** Judul dokumen di bawah garis pemisah. */
    title?: string;
    /** Baris keterangan di bawah judul, mis. periode laporan. */
    subtitle?: string;
}

const styles = StyleSheet.create({
    kop: {
        marginBottom: 14,
    },
    logoRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    logo: {
        width: 44,
        height: 44,
        objectFit: "contain",
    },
    nama: {
        fontSize: 14,
        fontFamily: "Times-Bold",
        textAlign: "center",
    },
    pemda: {
        fontSize: 9,
        fontFamily: "Times-Bold",
        textAlign: "center",
        marginBottom: 2,
    },
    alamat: {
        fontSize: 9,
        textAlign: "center",
        color: "#444",
    },
    npsn: {
        fontSize: 9,
        textAlign: "center",
        color: "#444",
    },
    garis: {
        borderBottomWidth: 2,
        borderBottomColor: "#000",
        marginVertical: 6,
    },
    judulWrap: {
        marginTop: 4,
        textAlign: "center",
    },
    judul: {
        fontSize: 12,
        fontFamily: "Times-Bold",
        textDecoration: "underline",
    },
    subjudul: {
        fontSize: 9,
        marginTop: 2,
    },
});

export function KopSuratPDF({
    schoolName,
    governanceName,
    schoolAddress,
    schoolNpsn,
    schoolPhone,
    schoolLogo,
    title,
    subtitle,
}: KopSuratPDFProps) {
    const name = schoolName || siteConfig.school.name;
    const address = schoolAddress || siteConfig.school.address;
    const npsn = schoolNpsn || siteConfig.school.npsn;
    const phone = schoolPhone || siteConfig.school.phone;

    return (
        <View style={styles.kop} fixed>
            {/* Image di sini adalah komponen @react-pdf (bukan img HTML),
                jadi aturan alt HTML tidak berlaku. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {schoolLogo ? <Image style={styles.logo} src={schoolLogo} /> : null}
            <View>
                {governanceName ? <Text style={styles.pemda}>{governanceName}</Text> : null}
                <Text style={styles.nama}>{name}</Text>
                {address ? <Text style={styles.alamat}>{address}</Text> : null}
                <Text style={styles.npsn}>
                    {npsn ? `NPSN: ${npsn}` : ""}
                    {npsn && phone ? " | " : ""}
                    {phone ? `Telp: ${phone}` : ""}
                </Text>
            </View>
            <View style={styles.garis} />
            {title ? (
                <View style={styles.judulWrap}>
                    <Text style={styles.judul}>{title}</Text>
                    {subtitle ? <Text style={styles.subjudul}>{subtitle}</Text> : null}
                </View>
            ) : null}
        </View>
    );
}
