import type { SPMBRegistrant } from "@/types";

// Dynamic import for xlsx and jspdf to reduce initial bundle
export async function exportToExcel(data: SPMBRegistrant[], filename: string = "pendaftar") {
    const XLSX = await import("xlsx");

    const exportData = data.map((item, index) => ({
        "No": index + 1,
        "No. Pendaftaran": item.registrationNumber,
        "Nama Siswa": item.fullName,
        "NIK Siswa": item.studentNik,
        "JK": item.gender === "L" ? "Laki-laki" : "Perempuan",
        "Tempat Lahir": item.birthPlace,
        "Tanggal Lahir": item.birthDate
            ? new Date(item.birthDate).toLocaleDateString("id-ID")
            : "",
        "Agama": item.religion,
        "Sekolah Asal": item.previousSchool,
        
        // Dapodik
        "Hobi": item.hobby,
        "Cita-cita": item.ambition,
        "Anak Ke": item.childOrder,
        "Jumlah Saudara": item.siblingCount,
        "Tinggi (cm)": item.height,
        "Berat (kg)": item.weight,
        "Lingkar Kepala": item.headCircumference,
        "Waktu Tempuh": item.travelTime,
        "Jarak (km)": item.distanceToSchool?.toFixed(2),
        "Domisili": (item.isInZone) ? "Dalam Wilayah" : "Luar Wilayah",

        // Alamat
        "Alamat Lengkap": item.address,
        "RT": item.addressRt,
        "RW": item.addressRw,
        "Desa/Kelurahan": item.addressVillage,
        "Kode Pos": item.postalCode,
        "Tempat Tinggal": item.livingArrangement,
        "Moda Transportasi": item.transportMode,

        // Kesejahteraan
        "Penerima KIP": item.hasKip ? "Ya" : "Tidak",
        "Penerima PKH/KPS": item.hasKpsPkh ? "Ya" : "Tidak",

        // Orang Tua - Ayah
        "Nama Ayah": item.fatherName,
        "NIK Ayah": item.fatherNik,
        "Tahun Lahir Ayah": item.fatherBirthYear,
        "Pendidikan Ayah": item.fatherEducation,
        "Pekerjaan Ayah": item.fatherJob,
        "Penghasilan Ayah": item.fatherIncome,

        // Orang Tua - Ibu
        "Nama Ibu": item.motherName,
        "NIK Ibu": item.motherNik,
        "Tahun Lahir Ibu": item.motherBirthYear,
        "Pendidikan Ibu": item.motherEducation,
        "Pekerjaan Ibu": item.motherJob,
        "Penghasilan Ibu": item.motherIncome,

        // Wali
        "Nama Wali": item.guardianName,
        "NIK Wali": item.guardianNik,
        "Pekerjaan Wali": item.guardianJob,

        // Kontak
        "No. HP Ortu": item.parentPhone,
        "Email": item.parentEmail,
        
        "Status": getStatusLabel(item.status),
        "Tanggal Daftar": new Date(item.createdAt).toLocaleDateString("id-ID"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pendaftar");

    // Auto-fit columns (simple approximation)
    const cols = Object.keys(exportData[0] || {}).map(() => ({ wch: 20 }));
    worksheet["!cols"] = cols;

    XLSX.writeFile(workbook, `${filename}-${getDateString()}.xlsx`);
}

export async function exportToPDF(data: SPMBRegistrant[], filename: string = "pendaftar") {
    const [{ default: jsPDF }, _] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable")
    ]);

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
    });

    // Title
    doc.setFontSize(16);
    doc.text("Daftar Pendaftar SPMB", 14, 15);

    doc.setFontSize(10);
    doc.text(`Tanggal Export: ${new Date().toLocaleDateString("id-ID")}`, 14, 22);
    doc.text(`Total: ${data.length} pendaftar`, 14, 28);

    // Table data
    const tableData = data.map((item, index) => [
        index + 1,
        item.registrationNumber,
        item.fullName,
        item.gender === "L" ? "L" : "P",
        item.fatherName?.substring(0, 20) || item.motherName?.substring(0, 20),
        item.parentPhone,
        item.distanceToSchool?.toFixed(1) + " km",
        item.isInZone ? "Dalam" : "Luar",
        getStatusLabel(item.status),
    ]);

    // Use type assertion for autoTable
    (doc as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable({
        startY: 35,
        head: [["#", "No. Pendaftaran", "Nama Siswa", "JK", "Orang Tua", "No. HP", "Jarak", "Domisili", "Status"]],
        body: tableData,
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: "bold",
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245],
        },
        columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 30 },
            2: { cellWidth: 40 },
            3: { cellWidth: 10 },
            4: { cellWidth: 35 },
            5: { cellWidth: 30 },
            6: { cellWidth: 15 },
            7: { cellWidth: 12 },
            8: { cellWidth: 25 },
        },
    });

    doc.save(`${filename}-${getDateString()}.pdf`);
}

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        pending: "Pending",
        verified: "Terverifikasi",
        accepted: "Diterima",
        rejected: "Ditolak",
    };
    return labels[status] || status;
}

function getDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}
