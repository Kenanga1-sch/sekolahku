import { describe, expect, it } from "vitest";
import { terbilang, terbilangRupiah } from "./terbilang";

describe("terbilang", () => {
    it("nol", () => {
        expect(terbilang(0)).toBe("nol");
    });

    it("satuan dan belasan", () => {
        expect(terbilang(1)).toBe("satu");
        expect(terbilang(7)).toBe("tujuh");
        expect(terbilang(10)).toBe("sepuluh");
        expect(terbilang(15)).toBe("lima belas");
    });

    it("puluhan dan ratusan", () => {
        expect(terbilang(21)).toBe("dua puluh satu");
        expect(terbilang(99)).toBe("sembilan puluh sembilan");
        expect(terbilang(100)).toBe("seratus");
        expect(terbilang(150)).toBe("seratus lima puluh");
        expect(terbilang(305)).toBe("tiga ratus lima");
    });

    it("ribuan dengan se- dan angka depan", () => {
        expect(terbilang(1000)).toBe("seribu");
        expect(terbilang(1500)).toBe("seribu lima ratus");
        expect(terbilang(20000)).toBe("dua puluh ribu");
        expect(terbilang(12500)).toBe("dua belas ribu lima ratus");
    });

    it("juta", () => {
        expect(terbilang(1_000_000)).toBe("satu juta");
        expect(terbilang(2_500_000)).toBe("dua juta lima ratus ribu");
        expect(terbilang(10_250_000)).toBe("sepuluh juta dua ratus lima puluh ribu");
    });

    it("miliar", () => {
        expect(terbilang(1_000_000_000)).toBe("satu miliar");
        expect(terbilang(1_500_000_000)).toBe("satu miliar lima ratus juta");
    });

    it("negatif", () => {
        expect(terbilang(-1000)).toBe("negatif seribu");
        expect(terbilang(-12500)).toBe("negatif dua belas ribu lima ratus");
    });

    it("pemakaian laporan: nominal umum tabungan sekolah", () => {
        expect(terbilang(2500)).toBe("dua ribu lima ratus");
        expect(terbilang(150000)).toBe("seratus lima puluh ribu");
        expect(terbilang(10000000)).toBe("sepuluh juta");
    });

    it("suffix dan kapital untuk dokumen", () => {
        expect(terbilang(1500, " rupiah")).toBe("seribu lima ratus rupiah");
        expect(terbilangRupiah(2500)).toBe("DUA RIBU LIMA RATUS RUPIAH");
        expect(terbilangRupiah(0)).toBe("NOL RUPIAH");
    });

    it("bilangan pecahan dibuang (trunc) sesuai nominal tabungan", () => {
        expect(terbilang(1000.75)).toBe("seribu");
    });
});
