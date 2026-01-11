// Email notification utility
// Note: In production, you would use a service like SendGrid, Mailgun, or Resend
// For now, this creates a flexible email service that can be configured

import { pb } from "./pocketbase";

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface RegistrantEmailData {
    studentName: string;
    registrationNumber: string;
    status: string;
    parentEmail: string;
    schoolName?: string;
}

// Email templates
const templates = {
    statusUpdate: (data: RegistrantEmailData) => ({
        subject: `[${data.schoolName || 'Sekolahku'}] Update Status Pendaftaran - ${data.registrationNumber}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-verified { background: #dbeafe; color: #1e40af; }
          .status-accepted { background: #d1fae5; color: #065f46; }
          .status-rejected { background: #fee2e2; color: #991b1b; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          a { color: #3b82f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 ${data.schoolName || 'Sekolahku'}</h1>
            <p>Sistem Penerimaan Murid Baru</p>
          </div>
          <div class="content">
            <p>Yth. Orang Tua/Wali dari <strong>${data.studentName}</strong>,</p>
            
            <p>Kami informasikan bahwa status pendaftaran anak Anda telah diperbarui:</p>
            
            <div class="info-box">
              <p><strong>No. Pendaftaran:</strong> ${data.registrationNumber}</p>
              <p><strong>Nama Siswa:</strong> ${data.studentName}</p>
              <p><strong>Status:</strong></p>
              <span class="status-badge status-${data.status}">${getStatusLabel(data.status)}</span>
            </div>
            
            ${getStatusMessage(data.status)}
            
            <p>Untuk informasi lebih lanjut, silakan kunjungi website kami atau hubungi pihak sekolah.</p>
            
            <p>Hormat kami,<br><strong>Tim SPMB ${data.schoolName || 'Sekolahku'}</strong></p>
          </div>
          <div class="footer">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `,
        text: `
Update Status Pendaftaran - ${data.schoolName || 'Sekolahku'}

Yth. Orang Tua/Wali dari ${data.studentName},

Status pendaftaran anak Anda telah diperbarui:

No. Pendaftaran: ${data.registrationNumber}
Nama Siswa: ${data.studentName}
Status: ${getStatusLabel(data.status)}

Untuk informasi lebih lanjut, silakan kunjungi website kami atau hubungi pihak sekolah.

Hormat kami,
Tim SPMB ${data.schoolName || 'Sekolahku'}
    `
    }),

    registrationConfirmation: (data: RegistrantEmailData) => ({
        subject: `[${data.schoolName || 'Sekolahku'}] Konfirmasi Pendaftaran - ${data.registrationNumber}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .reg-number { font-size: 24px; font-weight: bold; background: #f0fdf4; padding: 15px; text-align: center; border-radius: 8px; margin: 15px 0; color: #166534; font-family: monospace; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Pendaftaran Berhasil!</h1>
          </div>
          <div class="content">
            <p>Yth. Orang Tua/Wali,</p>
            
            <p>Selamat! Pendaftaran siswa baru atas nama <strong>${data.studentName}</strong> telah berhasil disubmit.</p>
            
            <div class="reg-number">${data.registrationNumber}</div>
            
            <p>Simpan nomor pendaftaran di atas untuk mengecek status pendaftaran di website kami.</p>
            
            <p>Langkah selanjutnya:</p>
            <ol>
              <li>Tunggu verifikasi dari pihak sekolah</li>
              <li>Pantau status pendaftaran melalui website</li>
              <li>Siapkan dokumen asli untuk verifikasi</li>
            </ol>
            
            <p>Hormat kami,<br><strong>Tim SPMB ${data.schoolName || 'Sekolahku'}</strong></p>
          </div>
          <div class="footer">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `,
        text: `Pendaftaran Berhasil!\n\nNo. Pendaftaran: ${data.registrationNumber}\nNama: ${data.studentName}\n\nSimpan nomor pendaftaran untuk mengecek status.`
    })
};

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        pending: "Menunggu Verifikasi",
        verified: "Terverifikasi",
        accepted: "DITERIMA ✓",
        rejected: "Tidak Diterima",
    };
    return labels[status] || status;
}

function getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
        pending: "<p>Data pendaftaran sedang dalam proses verifikasi. Mohon menunggu informasi selanjutnya.</p>",
        verified: "<p>Data pendaftaran telah diverifikasi. Proses seleksi sedang berlangsung.</p>",
        accepted: "<p><strong>🎉 Selamat!</strong> Anak Anda dinyatakan <strong>DITERIMA</strong> sebagai siswa baru. Silakan lakukan daftar ulang sesuai jadwal yang ditentukan.</p>",
        rejected: "<p>Mohon maaf, anak Anda belum dapat diterima di sekolah kami pada periode ini. Terima kasih atas partisipasinya.</p>",
    };
    return messages[status] || "";
}

// Main email sending function
// In production, replace this with actual email service (SendGrid, etc.)
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
    try {
        // Check if email settings exist in PocketBase
        // This would be configured in school_settings collection
        console.log("[Email] Sending email to:", options.to);
        console.log("[Email] Subject:", options.subject);

        // For production, integrate with SMTP or email service:
        // Example with fetch to an email API:
        /*
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options)
        });
        */

        // For now, log the email (development mode)
        console.log("[Email] Content preview:", options.html.substring(0, 200) + "...");

        return { success: true, message: "Email queued for sending" };
    } catch (error) {
        console.error("[Email] Failed to send:", error);
        return { success: false, message: String(error) };
    }
}

// Send status update notification
export async function sendStatusUpdateEmail(data: RegistrantEmailData): Promise<{ success: boolean; message: string }> {
    if (!data.parentEmail) {
        return { success: false, message: "No email address provided" };
    }

    const template = templates.statusUpdate(data);
    return sendEmail({
        to: data.parentEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
    });
}

// Send registration confirmation
export async function sendRegistrationConfirmation(data: RegistrantEmailData): Promise<{ success: boolean; message: string }> {
    if (!data.parentEmail) {
        return { success: false, message: "No email address provided" };
    }

    const template = templates.registrationConfirmation(data);
    return sendEmail({
        to: data.parentEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
    });
}
