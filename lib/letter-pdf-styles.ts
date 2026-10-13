/**
 * letter-pdf-styles.ts — StyleSheet PDF surat modular.
 *
 * Diekstrak dari letter-pdf.tsx (refactor, zero behavior change).
 */
import { StyleSheet } from "@react-pdf/renderer";
import type { LetterStandard } from "@/lib/config/letter-standards";
import { mapFont } from "@/lib/letter-render-shared";

export function buildStyles(standard: LetterStandard) {
  const font = mapFont(standard.typography.fontFamily);
  const { margins, typography } = standard;
  return StyleSheet.create({
    page: {
      fontFamily: font,
      fontSize: typography.fontSize,
      lineHeight: typography.lineHeight,
      paddingTop: margins.top,
      paddingRight: margins.right,
      paddingBottom: margins.bottom,
      paddingLeft: margins.left,
      color: "#000000",
    },
    kop: {
      borderBottomWidth: 2,
      borderBottomColor: "#000000",
      paddingBottom: 6,
      marginBottom: 12,
      textAlign: "center",
    },
    kopRow: { flexDirection: "row", alignItems: "center" },
    kopLogo: { width: 60, height: 60, marginRight: 10 },
    kopLogoRight: { width: 60, height: 60, marginLeft: 10 },
    kopInstansi: {
      fontSize: typography.headerFontSize - 3,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },
    kopDinas: {
      fontSize: typography.headerFontSize - 3,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },
    kopSekolah: {
      fontSize: typography.headerFontSize,
      fontWeight: "bold",
    },
    kopAlamat: { fontSize: typography.fontSize - 3, marginTop: 2 },
    kopGarisGanda: {
      borderBottomWidth: 1,
      borderBottomColor: "#000000",
      marginTop: 1,
    },
    judul: {
      textAlign: "center",
      fontWeight: "bold",
      fontSize: typography.fontSize + 2,
      textDecoration: "underline",
      marginBottom: 8,
    },
    row: { flexDirection: "row", marginBottom: 2 },
    labelCell: { width: 90 },
    colonCell: { width: 10 },
    valueCell: { flex: 1 },
    paragraf: { textAlign: "justify", marginBottom: typography.paragraphSpacing || 6 },
    tanggalKanan: { textAlign: "right", marginBottom: 8 },
    table: { borderWidth: 1, borderColor: "#000000", marginVertical: 6 },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000000" },
    th: {
      padding: 4,
      fontWeight: "bold",
      backgroundColor: "#eeeeee",
      borderRightWidth: 1,
      borderRightColor: "#000000",
    },
    td: { padding: 4, borderRightWidth: 1, borderRightColor: "#000000" },
    ttdWrap: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
    ttdBox: { width: "45%", textAlign: "center" },
    ttdSpace: { height: 60 },
    stamp: { width: 80, height: 80, alignSelf: "center", marginVertical: 4 },
    listRow: { flexDirection: "row", marginBottom: 2 },
    listBullet: { width: 14 },
    listText: { flex: 1, textAlign: "justify" },
    footer: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: typography.fontSize - 4,
      color: "#444444",
    },
  });
}
