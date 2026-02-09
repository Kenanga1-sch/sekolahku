import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Keep fonts simple for now, using built-in Helvetica/Times or register one if needed.
// For monospace numbers, we can use Courier, but let's stick to standard fonts first for reliability.

const styles = StyleSheet.create({
    page: {
        padding: "20mm",
        fontSize: 10,
        fontFamily: "Helvetica",
        flexDirection: "column",
    },
    header: {
        marginBottom: 20,
        textAlign: "center",
    },
    schoolName: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 4,
        textTransform: "uppercase",
    },
    schoolAddress: {
        fontSize: 10,
        color: "#555",
        marginBottom: 8,
    },
    reportTitle: {
        fontSize: 14,
        fontWeight: "bold",
        marginTop: 10,
        marginBottom: 20,
        textAlign: "center",
        textTransform: "uppercase",
        borderBottom: "1pt solid #000",
        paddingBottom: 10,
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "bold",
        marginBottom: 8,
        backgroundColor: "#f0f0f0",
        padding: 5,
    },
    row: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        alignItems: "center",
        minHeight: 24,
    },
    rowHeader: {
        backgroundColor: "#f8f9fa",
        borderBottomWidth: 1,
        borderBottomColor: "#000",
        fontWeight: "bold",
    },
    cell: {
        padding: 5,
        textAlign: "left",
    },
    cellRight: {
        padding: 5,
        textAlign: "right",
    },
    // Zebra striping
    rowOdd: {
        backgroundColor: "#ffffff",
    },
    rowEven: {
        backgroundColor: "#f9f9f9",
    },
    // Columns
    col1: { width: "25%" }, // Bulan/Keterangan
    col2: { width: "25%" }, // Setor
    col3: { width: "25%" }, // Tarik
    col4: { width: "25%" }, // Saldo
    
    // Summary Box
    summaryBox: {
        marginTop: 20,
        border: "1pt solid #000",
        borderRadius: 4,
        padding: 10,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 5,
    },
    totalRow: {
        marginTop: 10,
        borderTop: "1pt solid #000",
        paddingTop: 5,
        fontWeight: "bold",
    },
    
    // Footer / Signatures
    footer: {
        marginTop: 50,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    signatureBlock: {
        width: "40%",
        textAlign: "center",
    },
    signatureLine: {
        marginTop: 50,
        borderBottom: "1pt solid #000",
        marginBottom: 5,
    },
    
    statusBadge: {
        padding: "4 8",
        borderRadius: 4,
        fontSize: 10,
        textTransform: "uppercase",
        fontWeight: "bold",
        alignSelf: "center",
        marginBottom: 10,
    },
});

interface ReportData {
    period: {
        year: number;
        startDate: string;
        endDate: string;
    };
    siswa: {
        nama: string;
        nisn: string;
        kelas: string;
    };
    tabungan: {
        openingBalance: number;
        monthlySummary: {
            [key: string]: {
                setor: number;
                tarik: number;
                saldo: number;
            };
        };
        totalSetor: number;
        totalTarik: number;
        saldoAkhir: number;
    };
    hutang: {
        totalHutangAktif: number;
        rincian: any[];
    };
    settlement: {
        netBalance: number;
        status: "KURANG_BAYAR" | "SIAP_CAIR";
        terbilang: string;
    };
    generatedAt: string;
}

const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
};

const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: id });
};

const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMMM yyyy", { locale: id });
};

export const YearEndReportPDF = ({ report }: { report: ReportData }) => {
    const monthlyEntries = Object.entries(report.tabungan.monthlySummary).sort();

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.schoolName}>SMK Al-Ihya Selajambe</Text>
                    <Text style={styles.schoolAddress}>
                        Jalan Raya Selajambe No. 17, Selajambe, Kuningan, Jawa Barat 45566
                    </Text>
                    <Text style={styles.reportTitle}>Laporan Akhir Tahun Tabungan & Keuangan</Text>
                </View>

                {/* Student Info */}
                <View style={[styles.section, { border: "1pt solid #ddd", padding: 10, borderRadius: 4 }]}>
                    <View style={{ flexDirection: "row", marginBottom: 5 }}>
                        <Text style={{ width: "20%", fontWeight: "bold" }}>Nama Siswa</Text>
                        <Text style={{ width: "80%" }}>: {report.siswa.nama}</Text>
                    </View>
                    <View style={{ flexDirection: "row", marginBottom: 5 }}>
                        <Text style={{ width: "20%", fontWeight: "bold" }}>NISN</Text>
                        <Text style={{ width: "30%" }}>: {report.siswa.nisn}</Text>
                        <Text style={{ width: "20%", fontWeight: "bold" }}>Kelas</Text>
                        <Text style={{ width: "30%" }}>: {report.siswa.kelas}</Text>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                        <Text style={{ width: "20%", fontWeight: "bold" }}>Tahun Ajaran</Text>
                        <Text style={{ width: "80%" }}>: {report.period.year}</Text>
                    </View>
                </View>

                {/* Bagian 1: Ringkasan Tabungan */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Ringkasan Tabungan</Text>
                    
                    {/* Table Header */}
                    <View style={[styles.row, styles.rowHeader]}>
                        <Text style={[styles.cell, styles.col1]}>Bulan</Text>
                        <Text style={[styles.cellRight, styles.col2]}>Setor</Text>
                        <Text style={[styles.cellRight, styles.col3]}>Tarik</Text>
                        <Text style={[styles.cellRight, styles.col4]}>Saldo</Text>
                    </View>

                    {/* Opening Balance */}
                    <View style={[styles.row, styles.rowEven]}>
                        <Text style={[styles.cell, styles.col1]}>Saldo Awal</Text>
                        <Text style={[styles.cellRight, styles.col2]}>-</Text>
                        <Text style={[styles.cellRight, styles.col3]}>-</Text>
                        <Text style={[styles.cellRight, styles.col4]}>{formatRupiah(report.tabungan.openingBalance)}</Text>
                    </View>

                    {/* Transactions */}
                    {monthlyEntries.map(([month, data], index) => (
                        <View key={month} style={[styles.row, index % 2 === 0 ? styles.rowOdd : styles.rowEven]}>
                            <Text style={[styles.cell, styles.col1]}>{formatMonth(month)}</Text>
                            <Text style={[styles.cellRight, styles.col2, { color: data.setor > 0 ? "green" : "black" }]}>
                                {data.setor > 0 ? formatRupiah(data.setor) : "-"}
                            </Text>
                            <Text style={[styles.cellRight, styles.col3, { color: data.tarik > 0 ? "red" : "black" }]}>
                                {data.tarik > 0 ? formatRupiah(data.tarik) : "-"}
                            </Text>
                            <Text style={[styles.cellRight, styles.col4]}>{formatRupiah(data.saldo)}</Text>
                        </View>
                    ))}
                    
                    {/* Table Footer */}
                    <View style={[styles.row, { borderTopWidth: 2, borderTopColor: "#000", fontWeight: "bold", backgroundColor: "#f0f0f0" }]}>
                        <Text style={[styles.cell, styles.col1]}>TOTAL</Text>
                        <Text style={[styles.cellRight, styles.col2]}>{formatRupiah(report.tabungan.totalSetor)}</Text>
                        <Text style={[styles.cellRight, styles.col3]}>{formatRupiah(report.tabungan.totalTarik)}</Text>
                        <Text style={[styles.cellRight, styles.col4]}>{formatRupiah(report.tabungan.saldoAkhir)}</Text>
                    </View>
                </View>

                {/* Bagian 2: Hutang & Kewajiban (Conditional) */}
                {report.hutang.totalHutangAktif > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { backgroundColor: "#fff0f0", color: "#d32f2f" }]}>
                            2. Kewajiban / Hutang
                        </Text>
                        <View style={[styles.row, styles.rowHeader]}>
                            <Text style={[styles.cell, { width: "70%" }]}>Keterangan</Text>
                            <Text style={[styles.cellRight, { width: "30%" }]}>Jumlah</Text>
                        </View>
                        {report.hutang.rincian.map((item: any, idx: number) => (
                            <View key={idx} style={[styles.row, idx % 2 === 0 ? styles.rowOdd : styles.rowEven]}>
                                <Text style={[styles.cell, { width: "70%" }]}>{item.keterangan}</Text>
                                <Text style={[styles.cellRight, { width: "30%", color: "red" }]}>
                                    {formatRupiah(item.jumlah)}
                                </Text>
                            </View>
                        ))}
                        <View style={[styles.row, { borderTopWidth: 2, fontWeight: "bold" }]}>
                            <Text style={[styles.cell, { width: "70%" }]}>Total Kewajiban</Text>
                            <Text style={[styles.cellRight, { width: "30%", color: "red" }]}>
                                {formatRupiah(report.hutang.totalHutangAktif)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Bagian 3: Kesimpulan & Settlement */}
                <View style={styles.section} break={monthlyEntries.length > 10}>
                    <Text style={styles.sectionTitle}>3. Kesimpulan Akhir</Text>
                    
                    <View style={styles.summaryBox}>
                        <View style={{ marginBottom: 10, alignItems: "center" }}>
                            <Text style={[styles.statusBadge, { 
                                backgroundColor: report.settlement.status === "SIAP_CAIR" ? "#e6fffa" : "#fff5f5",
                                color: report.settlement.status === "SIAP_CAIR" ? "#047857" : "#c53030"
                            }]}>
                                {report.settlement.status === "SIAP_CAIR" ? "SIAP DICAIRKAN" : "MASIH ADA TUNGGAKAN"}
                            </Text>
                        </View>

                        <View style={styles.summaryRow}>
                            <Text>Saldo Tabungan Akhir</Text>
                            <Text style={{ fontWeight: "bold", color: "green" }}>{formatRupiah(report.tabungan.saldoAkhir)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text>Dikurangi Total Hutang</Text>
                            <Text style={{ fontWeight: "bold", color: "red" }}>({formatRupiah(report.hutang.totalHutangAktif)})</Text>
                        </View>
                        <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text>
                                {report.settlement.netBalance >= 0 ? "Sisa Uang Diterima Siswa" : "Kekurangan Yang Harus Dibayar"}
                            </Text>
                            <Text style={{ fontSize: 14 }}>
                                {formatRupiah(Math.abs(report.settlement.netBalance))}
                            </Text>
                        </View>
                        <View style={{ marginTop: 10, borderTop: "1pt dashed #ccc", paddingTop: 5 }}>
                            <Text style={{ fontSize: 9, fontStyle: "italic", textAlign: "center", color: "#666" }}>
                                Terbilang: {report.settlement.terbilang}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Footer Signatures */}
                <View style={styles.footer} break={monthlyEntries.length > 15}>
                    <View style={styles.signatureBlock}>
                        <Text>Mengetahui,</Text>
                        <Text>Orang Tua / Wali Siswa</Text>
                        <View style={styles.signatureLine} />
                        <Text style={{ fontSize: 9, color: "#777" }}>(Nama Jelas & Tanda Tangan)</Text>
                    </View>

                    <View style={styles.signatureBlock}>
                        <Text>Kuningan, {formatDate(new Date().toISOString())}</Text>
                        <Text>Bendahara Sekolah</Text>
                        <View style={styles.signatureLine} />
                        <Text style={{ fontWeight: "bold" }}>Admin Tabungan</Text>
                    </View>
                </View>

                {/* Page Number */}
                <Text 
                    style={{ position: "absolute", bottom: 20, right: 20, fontSize: 8, color: "#999" }}
                    render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`}
                    fixed
                />
            </Page>
        </Document>
    );
};
