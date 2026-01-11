import type { SPMBRegistrant } from "@/types";

// Dynamic import for xlsx and jspdf to reduce initial bundle
export async function exportToExcel(data: SPMBRegistrant[], filename: string = "pendaftar") {
    const XLSX = await import("xlsx");

    const exportData = data.map((item, index) => ({
        "No": index + 1,
        "No. Pendaftaran": item.registration_number,
        "Nama Siswa": item.student_name || item.full_name,
        "NIK": item.student_nik || item.nik,
        "Tempat Lahir": item.birth_place,
        "Tanggal Lahir": item.birth_date
            ? new Date(item.birth_date).toLocaleDateString("id-ID")
            : "",
        "Jenis Kelamin": item.gender === "L" ? "Laki-laki" : "Perempuan",
        "Nama Orang Tua": item.parent_name,
        "No. HP": item.parent_phone,
        "Email": item.parent_email,
        "Alamat": item.address || item.home_address,
        "Jarak (km)": item.distance_to_school?.toFixed(2),
        "Zonasi": (item.is_in_zone || item.is_within_zone) ? "Dalam Zona" : "Luar Zona",
        "Status": getStatusLabel(item.status),
        "Tanggal Daftar": new Date(item.created).toLocaleDateString("id-ID"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pendaftar");

    // Auto-fit columns
    const cols = Object.keys(exportData[0] || {}).map(() => ({ wch: 15 }));
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
        item.registration_number,
        item.student_name || item.full_name,
        item.gender === "L" ? "L" : "P",
        item.parent_name?.substring(0, 20),
        item.parent_phone,
        item.distance_to_school?.toFixed(1) + " km",
        (item.is_in_zone || item.is_within_zone) ? "✓" : "-",
        getStatusLabel(item.status),
    ]);

    // Use type assertion for autoTable
    (doc as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable({
        startY: 35,
        head: [["#", "No. Pendaftaran", "Nama Siswa", "JK", "Orang Tua", "No. HP", "Jarak", "Zona", "Status"]],
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
