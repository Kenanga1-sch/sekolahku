/**
 * report-pdf.tsx — Client-side PDF Generator untuk Report Builder (@react-pdf/renderer).
 */

/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";
import type { ReportDocumentData } from "@/lib/config/report-document";
import type { ReportColumnConfig, ReportKPIItemConfig } from "@/lib/config/report-blocks";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import {
  processReportTable,
  processReportKPI,
  formatCellValue,
  formatRupiah,
} from "@/lib/report-engine";

export interface ReportPdfInput {
  document: ReportDocumentData;
  school: LetterSchoolData;
  dataset?: Record<string, any>[];
  extraSummary?: Record<string, number | string>;
  fileName?: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 45,
    paddingLeft: 40,
    paddingRight: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1e293b",
    lineHeight: 1.4,
  },
  // Kop
  kopWrapper: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 6,
    marginBottom: 12,
  },
  kopHeaderFlex: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 55,
    height: 55,
    objectFit: "contain",
  },
  kopCenter: {
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  govText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  deptText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  schoolText: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginVertical: 1,
  },
  addressText: {
    fontSize: 8,
    color: "#334155",
  },

  // Header Judul & Filter
  titleWrapper: {
    textAlign: "center",
    marginVertical: 10,
  },
  titleText: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  subtitleText: {
    fontSize: 9,
    color: "#475569",
  },
  filterBox: {
    backgroundColor: "#f8fafc",
    padding: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  filterText: {
    fontSize: 8.5,
    color: "#334155",
  },

  // Kartu Ringkasan KPI
  kpiWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 8,
    borderRadius: 4,
  },
  kpiLabel: {
    fontSize: 7.5,
    color: "#64748b",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  // Tabel Data Dinamis
  table: {
    width: "100%",
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#94a3b8",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1.5,
    borderBottomColor: "#475569",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    minHeight: 18,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#f8fafc",
  },
  tableFooterRow: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderTopWidth: 1.5,
    borderTopColor: "#0f172a",
    minHeight: 20,
    alignItems: "center",
  },
  th: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    padding: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#cbd5e1",
  },
  td: {
    fontSize: 8,
    padding: 4,
    borderRightWidth: 0.5,
    borderRightColor: "#e2e8f0",
  },

  // TTD
  ttdWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  ttdBox: {
    width: "40%",
    alignItems: "center",
    textAlign: "center",
  },
  ttdSpace: {
    height: 45,
  },
  stamp: {
    width: 65,
    height: 65,
    objectFit: "contain",
  },

  // Footer Nomor Halaman
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
});

export function ReportPdfDocument({ document: doc, school, dataset = [], extraSummary }: ReportPdfInput) {
  const paperSize = (doc.paperSize === "F4" ? "A4" : doc.paperSize) || "A4";
  const orientation = doc.orientation || "portrait";

  return (
    <Document title={doc.reportName || "Laporan Laporan"}>
      {doc.pages.map((p, pIdx) => (
        <Page key={p.id || pIdx} size={paperSize} orientation={orientation} style={styles.page}>
          {p.blocks.map((b) => {
            if (!b.enabled) return null;
            const d = b.data || {};

            switch (b.blockId) {
              case "kop_laporan": {
                if (p.useHeader === false) return null;
                return (
                  <View style={styles.kopWrapper} key={b.instanceId}>
                    <View style={styles.kopHeaderFlex}>
                      {school.logoUrl ? <Image src={school.logoUrl} style={styles.logo} /> : <View style={styles.logo} />}
                      <View style={styles.kopCenter}>
                        <Text style={styles.govText}>{school.governanceLine}</Text>
                        <Text style={styles.deptText}>{school.departmentLine}</Text>
                        <Text style={styles.schoolText}>{school.schoolName}</Text>
                        <Text style={styles.addressText}>
                          {school.address} • Telp: {school.phone || "-"} • Email: {school.email || "-"}
                        </Text>
                      </View>
                      <View style={styles.logo} />
                    </View>
                  </View>
                );
              }

              case "judul_laporan": {
                return (
                  <View style={styles.titleWrapper} key={b.instanceId}>
                    <Text style={styles.titleText}>{String(d.judul || "LAPORAN")}</Text>
                    {d.subjudul && <Text style={styles.subtitleText}>{String(d.subjudul)}</Text>}
                  </View>
                );
              }

              case "metadata_filter": {
                if (!d.keterangan) return null;
                return (
                  <View style={styles.filterBox} key={b.instanceId}>
                    <Text style={styles.filterText}>{String(d.keterangan)}</Text>
                  </View>
                );
              }

              case "ringkasan_kpi": {
                const kpiConfig: ReportKPIItemConfig[] = Array.isArray(d.items) ? d.items : [];
                const kpiRes = processReportKPI(kpiConfig, dataset, extraSummary);
                if (kpiRes.items.length === 0) return null;

                return (
                  <View style={styles.kpiWrapper} key={b.instanceId}>
                    {kpiRes.items.map((it, idx) => (
                      <View style={styles.kpiCard} key={idx}>
                        <Text style={styles.kpiLabel}>{it.label}</Text>
                        <Text style={styles.kpiValue}>{it.value}</Text>
                      </View>
                    ))}
                  </View>
                );
              }

              case "tabel_laporan": {
                const rawCols: ReportColumnConfig[] = Array.isArray(d.columns) ? d.columns : [];
                const tableRes = processReportTable(rawCols, dataset);

                // Hitung lebar total kolom untuk kalkulasi persentase
                const totalConfigWidth = tableRes.columns.reduce((acc, c) => acc + (c.width || 100), 0);

                return (
                  <View style={styles.table} key={b.instanceId}>
                    {/* Table Header */}
                    <View style={styles.tableHeaderRow}>
                      {tableRes.columns.map((c) => {
                        const colWidthPct = `${((c.width || 100) / totalConfigWidth) * 100}%`;
                        return (
                          <Text
                            key={c.key}
                            style={[
                              styles.th,
                              {
                                width: colWidthPct,
                                textAlign: c.align || "left",
                              },
                            ]}
                          >
                            {c.label}
                          </Text>
                        );
                      })}
                    </View>

                    {/* Table Rows */}
                    {tableRes.rows.map((r, rIdx) => (
                      <View
                        key={rIdx}
                        style={rIdx % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}
                      >
                        {tableRes.columns.map((c) => {
                          const colWidthPct = `${((c.width || 100) / totalConfigWidth) * 100}%`;
                          const formattedVal = formatCellValue(r[c.key], c.format);
                          return (
                            <Text
                              key={c.key}
                              style={[
                                styles.td,
                                {
                                  width: colWidthPct,
                                  textAlign: c.align || "left",
                                },
                              ]}
                            >
                              {formattedVal}
                            </Text>
                          );
                        })}
                      </View>
                    ))}

                    {/* Table Footer / Auto-Sum Row */}
                    {tableRes.hasAutoSum && (
                      <View style={styles.tableFooterRow}>
                        {tableRes.columns.map((c, cIdx) => {
                          const colWidthPct = `${((c.width || 100) / totalConfigWidth) * 100}%`;
                          let labelText = "";
                          if (cIdx === 0) labelText = "TOTAL";
                          else if (c.autoSum && tableRes.totals[c.key] !== null) {
                            labelText =
                              c.format === "rupiah"
                                ? formatRupiah(tableRes.totals[c.key])
                                : String(tableRes.totals[c.key]);
                          }

                          return (
                            <Text
                              key={c.key}
                              style={[
                                styles.th,
                                {
                                  width: colWidthPct,
                                  textAlign: c.align || (cIdx === 0 ? "center" : "left"),
                                  fontFamily: "Helvetica-Bold",
                                },
                              ]}
                            >
                              {labelText}
                            </Text>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }

              case "catatan_penutup": {
                if (!d.text) return null;
                return (
                  <View style={{ marginVertical: 6 }} key={b.instanceId}>
                    <Text style={{ fontSize: 8, color: "#475569" }}>{String(d.text)}</Text>
                  </View>
                );
              }

              case "tanda_tangan": {
                return (
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }} key={b.instanceId}>
                    <View style={styles.ttdBox}>
                      <Text>{String(d.jabatan || "Kepala Sekolah")}</Text>
                      {String(d.show_stamp) === "true" && school.stampUrl ? (
                        <Image src={school.stampUrl} style={styles.stamp} />
                      ) : (
                        <View style={styles.ttdSpace} />
                      )}
                      <Text style={{ fontFamily: "Helvetica-Bold", textDecoration: "underline" }}>
                        {String(d.nama) || school.principalName}
                      </Text>
                      {(d.nip || school.principalNip) && <Text>NIP. {String(d.nip) || school.principalNip}</Text>}
                    </View>
                  </View>
                );
              }

              case "tanda_tangan_ganda": {
                return (
                  <View style={styles.ttdWrap} key={b.instanceId}>
                    <View style={styles.ttdBox}>
                      <Text>{String(d.kiri_jabatan || "Pihak I")}</Text>
                      <View style={styles.ttdSpace} />
                      <Text style={{ fontFamily: "Helvetica-Bold", textDecoration: "underline" }}>
                        {String(d.kiri_nama || "-")}
                      </Text>
                      {d.kiri_nip && <Text>NIP. {String(d.kiri_nip)}</Text>}
                    </View>
                    <View style={styles.ttdBox}>
                      <Text>{String(d.kanan_jabatan || "Kepala Sekolah")}</Text>
                      {String(d.show_stamp) === "true" && school.stampUrl ? (
                        <Image src={school.stampUrl} style={styles.stamp} />
                      ) : (
                        <View style={styles.ttdSpace} />
                      )}
                      <Text style={{ fontFamily: "Helvetica-Bold", textDecoration: "underline" }}>
                        {String(d.kanan_nama) || school.principalName}
                      </Text>
                      {(d.kanan_nip || school.principalNip) && (
                        <Text>NIP. {String(d.kanan_nip) || school.principalNip}</Text>
                      )}
                    </View>
                  </View>
                );
              }

              default:
                return null;
            }
          })}

          {doc.showFooter && (
            <View style={styles.pageFooter} fixed>
              <Text>{school.schoolName} — System Report</Text>
              <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}

export async function generateReportPdf(input: ReportPdfInput): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  return pdf(<ReportPdfDocument {...input} />).toBlob();
}
