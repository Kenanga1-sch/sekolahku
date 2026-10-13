/**
 * letter-pdf-blocks.tsx — Renderer satu blok surat (PDF).
 *
 * Diekstrak dari letter-pdf.tsx (refactor, zero behavior change).
 */
import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import type { LetterBlockInstance } from "@/lib/config/letter-blocks";
import {
  asString,
  formatTanggalIndo,
  isEmptyText,
  substitute,
  tempatTanggal,
} from "@/lib/letter-render-shared";
import { renderRich, type BlockRenderCtx } from "./letter-pdf-rich";

export function renderKop(
  variant: string,
  ctx: BlockRenderCtx
): React.ReactElement {
  const { styles, school } = ctx;
  const showLogoLeft = variant === "logo_kiri" || variant === "pemerintah" || variant === "lengkap";
  const showLogoRight = variant === "logo_kanan";
  const showGovernance = variant === "pemerintah" || variant === "lengkap";
  const doubleLine = variant === "lengkap" || variant === "garis_ganda";
  const logo = school.logoUrl;

  return (
    <View style={styles.kop}>
      <View style={styles.kopRow}>
        {showLogoLeft && logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logo} style={styles.kopLogo} />
        ) : null}
        <View style={{ flex: 1 }}>
          {showGovernance && (
            <>
              <Text style={styles.kopInstansi}>
                {school.governanceLine || "PEMERINTAH DAERAH"}
              </Text>
              <Text style={styles.kopDinas}>
                {school.departmentLine || "DINAS PENDIDIKAN"}
              </Text>
            </>
          )}
          <Text style={styles.kopSekolah}>{school.schoolName}</Text>
          <Text style={styles.kopAlamat}>{school.address}</Text>
          {(school.phone || school.email || school.website) && (
            <Text style={styles.kopAlamat}>
              {[
                school.phone ? `Telp. ${school.phone}` : "",
                school.email || "",
                school.website || "",
              ]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          )}
        </View>
        {showLogoRight && logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logo} style={styles.kopLogoRight} />
        ) : null}
      </View>
      {doubleLine && <View style={styles.kopGarisGanda} />}
    </View>
  );
}

export function renderBlock(
  inst: LetterBlockInstance,
  ctx: BlockRenderCtx
): React.ReactElement | null {
  const { styles, school } = ctx;
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), ctx.vars);
  const key = inst.instanceId;

  switch (inst.blockId) {
    case "kop_surat":
      return renderKop(asString(d.variant) || "pemerintah", ctx);
    case "judul":
    case "judul_memo":
      return (
        <Text style={styles.judul} key={key}>
          {S(d.text)}
        </Text>
      );
    case "tanggal":
      return (
        <View style={styles.row} key={key}>
          <Text style={{ flex: 1 }} />
          <Text>{tempatTanggal(S(d.tempat), asString(d.tanggal))}</Text>
        </View>
      );
    case "nomor_perihal_lampiran":
      return (
        <View style={{ marginBottom: 8 }} key={key}>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Nomor</Text>
            <Text style={styles.colonCell}>:</Text>
            <Text style={styles.valueCell}>
              {S(d.nomor) || ctx.vars.nomor_surat || "-"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Perihal</Text>
            <Text style={styles.colonCell}>:</Text>
            <Text style={styles.valueCell}>{S(d.perihal) || "-"}</Text>
          </View>
          {!isEmptyText(d.lampiran) && (
            <View style={styles.row}>
              <Text style={styles.labelCell}>Lampiran</Text>
              <Text style={styles.colonCell}>:</Text>
              <Text style={styles.valueCell}>{S(d.lampiran)}</Text>
            </View>
          )}
        </View>
      );
    case "tujuan":
      return (
        <View style={{ marginBottom: 8 }} key={key}>
          <Text>Kepada Yth.</Text>
          <Text style={{ fontWeight: "bold" }}>{S(d.kepada)}</Text>
          {!isEmptyText(d.di_tempat) && <Text>{S(d.di_tempat)}</Text>}
        </View>
      );
    case "salam_pembuka":
    case "penutup":
    case "isi":
      if (d.text && typeof d.text === "string" && d.text.trimStart().startsWith("{")) {
        return renderRich(asString(d.text), ctx, key);
      }
      return (
        <Text style={styles.paragraf} key={key}>
          {S(d.text)}
        </Text>
      );
    case "pelaksanaan_acara":
      return (
        <View style={{ marginVertical: 6 }} key={key}>
          {(
            [
              ["Hari", S(d.hari)],
              ["Tanggal", d.tanggal ? formatTanggalIndo(asString(d.tanggal)) : ""],
              ["Waktu", S(d.waktu)],
              ["Tempat", S(d.tempat)],
              ["Agenda", S(d.agenda)],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <View style={styles.row} key={String(k)}>
                <Text style={styles.labelCell}>{k}</Text>
                <Text style={styles.colonCell}>:</Text>
                <Text style={styles.valueCell}>{v}</Text>
              </View>
            ))}
        </View>
      );
    case "tabel_penugasan":
    case "tabel_generik":
      return renderGenericTable(inst, ctx, key);
    case "tabel_data_siswa":
      return (
        <View style={{ marginVertical: 6 }} key={key}>
          {(
            [
              ["Nama", S(d.nama)],
              ["NISN", S(d.nisn)],
              ["Kelas", S(d.kelas)],
              ["Tempat/Tgl Lahir", S(d.tempat_tanggal_lahir)],
              ["Alamat", S(d.alamat)],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <View style={styles.row} key={String(k)}>
                <Text style={styles.labelCell}>{k}</Text>
                <Text style={styles.colonCell}>:</Text>
                <Text style={styles.valueCell}>{v}</Text>
              </View>
            ))}
        </View>
      );
    case "tanggal_bawah":
      return (
        <View style={{ marginTop: 12, marginBottom: 4 }} key={key}>
          <View style={styles.row}>
            <Text style={{ flex: 1 }} />
            <Text>{tempatTanggal(S(d.tempat), asString(d.tanggal))}</Text>
          </View>
        </View>
      );
    case "tanda_tangan":
      return (
        <View style={styles.ttdWrap} key={key}>
          <View style={styles.ttdBox} />
          <View style={styles.ttdBox}>
            <Text>{S(d.jabatan)}</Text>
            {asString(d.show_stamp) === "true" && school.stampUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={school.stampUrl} style={styles.stamp} />
            ) : (
              <View style={styles.ttdSpace} />
            )}
            <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
              {S(d.nama) || school.principalName}
            </Text>
            <Text>NIP. {S(d.nip) || school.principalNip}</Text>
          </View>
        </View>
      );
    case "tanda_tangan_ganda":
      if (asString(d.layout) === "bertingkat") {
        return (
          <View style={{ marginTop: 12 }} key={key}>
            {/* Pihak I di kanan atas */}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 16 }}>
              <View style={styles.ttdBox}>
                <Text>{S(d.kiri_jabatan)}</Text>
                <View style={styles.ttdSpace} />
                <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  {S(d.kiri_nama)}
                </Text>
                {!isEmptyText(d.kiri_nip) && <Text>NIP. {S(d.kiri_nip)}</Text>}
              </View>
            </View>
            {/* Mengetahui di bawah tengah */}
            <View style={{ flexDirection: "row", justifyContent: "center" }}>
              <View style={styles.ttdBox}>
                <Text style={{ marginBottom: 2 }}>Mengetahui,</Text>
                <Text>{S(d.kanan_jabatan) || school.principalName}</Text>
                {asString(d.show_stamp) === "true" && school.stampUrl ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={school.stampUrl} style={styles.stamp} />
                ) : (
                  <View style={styles.ttdSpace} />
                )}
                <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
                  {S(d.kanan_nama) || school.principalName}
                </Text>
                {(!isEmptyText(d.kanan_nip) || school.principalNip) && (
                  <Text>NIP. {S(d.kanan_nip) || school.principalNip}</Text>
                )}
              </View>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.ttdWrap} key={key}>
          <View style={styles.ttdBox}>
            <Text>{S(d.kiri_jabatan)}</Text>
            <View style={styles.ttdSpace} />
            <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
              {S(d.kiri_nama)}
            </Text>
            {!isEmptyText(d.kiri_nip) && <Text>NIP. {S(d.kiri_nip)}</Text>}
          </View>
          <View style={styles.ttdBox}>
            <Text>{S(d.kanan_jabatan)}</Text>
            {asString(d.show_stamp) === "true" && school.stampUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={school.stampUrl} style={styles.stamp} />
            ) : (
              <View style={styles.ttdSpace} />
            )}
            <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
              {S(d.kanan_nama) || school.principalName}
            </Text>
            {(!isEmptyText(d.kanan_nip) || school.principalNip) && (
              <Text>NIP. {S(d.kanan_nip) || school.principalNip}</Text>
            )}
          </View>
        </View>
      );
    case "ttd_tiga":
      return (
        <View style={[styles.ttdWrap, { justifyContent: "space-between" }]} key={key}>
          {(
            [
              ["kiri", "kiri_jabatan", "kiri_nama", "kiri_nip"],
              ["tengah", "tengah_jabatan", "tengah_nama", "tengah_nip"],
              ["kanan", "kanan_jabatan", "kanan_nama", "kanan_nip"],
            ] as [string, string, string, string][]
          ).map(([pid, jk, nk, nipk]) => (
            <View style={[styles.ttdBox, { width: "31%" }]} key={pid}>
              <Text>{S(d[jk])}</Text>
              <View style={styles.ttdSpace} />
              <Text style={{ fontWeight: "bold", textDecoration: "underline" }}>
                {S(d[nk])}
              </Text>
              {!isEmptyText(d[nipk]) && <Text>NIP. {S(d[nipk])}</Text>}
            </View>
          ))}
        </View>
      );
    case "tembusan":
      return (
        <View style={{ marginTop: 16 }} key={key}>
          <Text style={{ textDecoration: "underline" }}>
            {S(d.judul) || "Tembusan:"}
          </Text>
          {asString(d.daftar)
            .split("\n")
            .map((l) => S(l).trim())
            .filter(Boolean)
            .map((l, i) => (
              <Text key={i} style={{ marginLeft: 8 }}>
                {i + 1}. {l}
              </Text>
            ))}
        </View>
      );
    case "catatan_kaki":
      return (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 4 }} key={key}>
          <Text style={{ fontSize: ctx.standard.typography.fontSize - 3, fontStyle: "italic" }}>
            {S(d.text)}
          </Text>
        </View>
      );
    case "qr_verifikasi":
      return !isEmptyText(d.url) && d.url ? (
        <View style={{ marginTop: 12, alignItems: "flex-start" }} key={key}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={asString(d.url)} style={{ width: 70, height: 70 }} />
          <Text style={{ fontSize: ctx.standard.typography.fontSize - 4, marginTop: 2 }}>
            {S(d.caption) || "Pindai untuk verifikasi"}
          </Text>
        </View>
      ) : null;
    case "gambar":
      return !isEmptyText(d.url) && d.url ? (
        <View style={{ marginVertical: 6, alignItems: "center" }} key={key}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={asString(d.url)}
            style={{ width: 220, objectFit: "contain" }}
          />
          {!isEmptyText(d.caption) && (
            <Text style={{ fontSize: ctx.standard.typography.fontSize - 3, marginTop: 2 }}>
              {S(d.caption)}
            </Text>
          )}
        </View>
      ) : null;
    case "daftar_lampiran":
      return (
        <View key={key}>
          {!isEmptyText(d.judul) && (
            <Text style={[styles.judul, { textAlign: "left" }]}>{S(d.judul)}</Text>
          )}
          {renderRich(asString(d.isi), ctx, `${key}-lamp`)}
        </View>
      );
    case "garis_pemisah":
      return (
        <View
          key={key}
          style={{ borderBottomWidth: Number(asString(d.tebal)) || 1, borderBottomColor: "#000000", marginVertical: 8 }}
        />
      );
    case "dua_kolom": {
      const ratio = asString(d.ratio) || "50:50";
      const leftW = ratio === "40:60" ? 40 : ratio === "60:40" ? 60 : 50;
      const gap = 12;
      const full = 100 - gap;
      const leftPct = (leftW / 100) * full;
      const rightPct = full - leftPct;
      return (
        <View key={key} style={{ flexDirection: "row", gap, marginBottom: 4 }}>
          <View style={{ width: `${leftPct}%` }}>{renderRich(asString(d.kiri), ctx, `${key}-l`)}</View>
          <View style={{ width: `${rightPct}%` }}>{renderRich(asString(d.kanan), ctx, `${key}-r`)}</View>
        </View>
      );
    }
    case "daftar_centang":
      return (
        <View key={key} style={{ marginVertical: 4 }}>
          {!isEmptyText(d.judul) && <Text style={[styles.paragraf, { fontWeight: "bold" }]}>{S(d.judul)}</Text>}
          {asString(d.daftar)
            .split("\n")
            .map((l) => S(l).trim())
            .filter(Boolean)
            .map((l, i) => (
              <View style={styles.listRow} key={i}>
                <Text style={[styles.listBullet, { width: 18 }]}>☐</Text>
                <Text style={styles.listText}>{l}</Text>
              </View>
            ))}
        </View>
      );
    case "tanda_tangan_basah":
      return !isEmptyText(d.url) && d.url ? (
        <View
          key={key}
          style={{ marginVertical: 6, alignItems: asString(d.posisi) === "kiri" ? "flex-start" : asString(d.posisi) === "tengah" ? "center" : "flex-end" }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={asString(d.url)}
            style={{ width: Number(asString(d.lebar)) || 150, objectFit: "contain" }}
          />
        </View>
      ) : null;
    case "barcode":
      return !isEmptyText(d.text) && d.text ? (
        <View
          key={key}
          style={{ marginVertical: 6, alignItems: asString(d.posisi) === "kiri" ? "flex-start" : asString(d.posisi) === "tengah" ? "center" : "flex-end" }}
        >
          <Text style={{ fontFamily: "Courier", fontSize: ctx.standard.typography.fontSize + 6 }}>
            {S(d.text)}
          </Text>
          {!isEmptyText(d.caption) && (
            <Text style={{ fontSize: ctx.standard.typography.fontSize - 3, marginTop: 2 }}>
              {S(d.caption)}
            </Text>
          )}
        </View>
      ) : null;
    case "page_break":
      // Blok pemisah halaman tidak dirender sebagai konten.
      return null;
    default:
      return null;
  }
}

/** Render tabel generik / penugasan dari data JSON (kolom + baris). */
export function renderGenericTable(
  inst: LetterBlockInstance,
  ctx: BlockRenderCtx,
  key: string
): React.ReactElement | null {
  const { styles } = ctx;
  const d = inst.data;
  const S = (v: unknown) => substitute(asString(v), ctx.vars);

  let columns: { key: string; label: string; width?: number }[] = [];
  let rows: string[][] = [];

  // Format baru: satu field `table` berisi JSON {columns, rows}.
  if (typeof d.table === "string" && d.table.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(d.table);
      if (Array.isArray(parsed.columns)) columns = parsed.columns;
      if (Array.isArray(parsed.rows)) rows = parsed.rows;
    } catch {
      /* fallback ke format lama */
    }
  }

  // Format lama (pipe-separated pada field `rows`).
  if (columns.length === 0 && !isEmptyText(d.rows)) {
    const raw = asString(d.rows);
    const parsed = raw
      .split("\n")
      .map((line) => S(line).split("|").map((c) => c.trim()))
      .filter((cells) => cells.some(Boolean));
    const maxCols = Math.max(1, ...parsed.map((r) => r.length + 1));
    columns = ["No", "Nama", "NIP", "Jabatan", "Uraian"]
      .slice(0, maxCols)
      .map((h, i) => ({ key: `c${i}`, label: h }));
    rows = parsed.map((r, ri) => [String(ri + 1), ...r]);
  }

  if (columns.length === 0) return null;

  return (
    <View style={styles.table} key={key} wrap={false}>
      <View style={[styles.tr, { backgroundColor: "#eeeeee" }]}>
        {columns.map((c, i) => (
          <Text
            style={[styles.th, c.width ? { flex: 0, width: c.width } : { flex: 1 }]}
            key={i}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View style={styles.tr} key={ri}>
          {columns.map((c, ci) => (
            <Text
              style={[styles.td, c.width ? { flex: 0, width: c.width } : { flex: 1 }]}
              key={ci}
            >
              {S(r[ci] || "")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
