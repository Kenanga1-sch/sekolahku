/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Create styles
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    padding: 40,
    fontSize: 11,
    lineHeight: 1.3,
    backgroundColor: '#fff',
  },
  // Kop Surat - Mimicking HTML "absolute" layout
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 5,
    position: 'relative',
    height: 90, // Fixed height to contain logo
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoAbs: {
    position: 'absolute',
    left: 10,
    top: 5,
    width: 65,
    height: 65,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  headerTextCenter: {
    textAlign: 'center',
    width: '80%', // Match HTML w-[80%]
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  // Text Styles matching HTML Fonts
  h1_pemda: {
    fontFamily: 'Times-Bold',
    fontSize: 14,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  h2_dinas: {
    fontFamily: 'Times-Bold',
    fontSize: 14,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  h3_school: {
    fontFamily: 'Times-Bold', // Best equivalent for Bookman (Serif)
    fontSize: 18,
    marginBottom: 4,
    textTransform: 'uppercase',
    color: '#1d4ed8', // blue-700
  },
  p_npsn: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    marginBottom: 2,
  },
  p_addr: {
    fontFamily: 'Times-Roman',
    fontSize: 9,
    marginBottom: 1,
  },
  p_email: {
    fontFamily: 'Times-Roman',
    fontSize: 9,
  },
  
  // Lines matching HTML
  lineThick: {
    height: 3,
    backgroundColor: '#000',
    marginTop: 10,
    marginBottom: 2,
  },
  lineThin: {
    height: 1,
    backgroundColor: '#000',
    marginBottom: 20,
  },

  // Document Title
  docTitleBox: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  docTitleText: { // Renamed from docTitle to match usage if needed, or use inline style
    fontSize: 16,
    fontFamily: 'Times-Bold',
    textTransform: 'uppercase',
    textDecoration: 'underline',
  },

  // Two Column Layout
  rowContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    width: 150,
  },

  // Section Box Styles (Blue Header)
  sectionContainer: {
    marginBottom: 15,
  },
  sectionHeaderBox: {
    backgroundColor: '#1e3a8a', // blue-900
    padding: 5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  sectionHeaderText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  sectionContentBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#d1d5db', // gray-300
    padding: 8,
  },

  // Table Styles
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6', // gray-100
    paddingVertical: 4,
  },
  tableRowPlain: {
     flexDirection: 'row',
     paddingVertical: 4,
  },
  
  // Cell Widths
  labelCell: {
    width: 120,
    fontFamily: 'Helvetica', 
    color: '#4b5563', // gray-600
    fontSize: 10,
  },
  colonCell: {
    width: 10,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  valueCell: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#000',
  },
  valueCellBlue: {
    flex: 1,
    fontFamily: 'Helvetica-Bold', 
    fontSize: 11,
    color: '#1e3a8a', // blue-900
  },

  // Sidebar Panels
  sidebarBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb', // gray-50
    padding: 10,
    alignItems: 'center',
    height: 480, // min-h equivalent
  },
  photoFrame: {
    width: 85, // 3cm
    height: 113, // 4cm
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  qrFrame: {
    width: 100,
    height: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  
  // Footer / Disclaimer
  disclaimerBox: {
    backgroundColor: '#eff6ff', // blue-50
    borderWidth: 1,
    borderColor: '#dbeafe', // blue-100
    padding: 10,
    marginBottom: 20,
    borderRadius: 4,
  },
  disclaimerTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  disclaimerText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1e3a8a',
    lineHeight: 1.4,
    marginLeft: 10,
  },

  // Signatures
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  metaText: {
    fontSize: 8,
    color: '#9ca3af',
    fontFamily: 'Helvetica',
  },
  signColumn: {
    width: 200,
    alignItems: 'center',
  },
  signGap: {
    height: 50,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    width: 150,
    marginBottom: 4,
  },
});

type RegistrantData = {
  registrationNumber: string;
  fullName: string;
  studentNik: string;
  birthPlace: string;
  birthDate: Date;
  gender: string;
  previousSchool?: string | null;
  address: string;
  id: string;
  createdAt: Date;
  qrCodeUrl: string;
  distanceToSchool?: number | null;
};

export const RegistrantDocument = ({ data }: { data: RegistrantData }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header - Absolute Logo, Center Text */}
        <View style={styles.headerContainer}>
            <View style={styles.logoAbs}>
                <Image src="/logo.png" style={styles.logoImg} />
            </View>
            <View style={styles.headerTextCenter}>
                <Text style={styles.h1_pemda}>PEMERINTAH KABUPATEN INDRAMAYU</Text>
                <Text style={styles.h2_dinas}>DINAS PENDIDIKAN DAN KEBUDAYAAN</Text>
                <Text style={styles.h3_school}>UPTD SDN 1 KENANGA</Text>
                <Text style={styles.p_npsn}>NSS/NPSN : 10.1.02.18.160.15 / 20216609</Text>
                <Text style={styles.p_addr}>Alamat : Jl. Perindustrian Blok Dukuh Desa Kenanga Kec. Sindang Kab. Indramayu 45226</Text>
                <Text style={styles.p_email}>Email : <Text style={{ color: '#1d4ed8', textDecoration: 'underline' }}>uptdsdn1kenangasindang@gmail.com</Text></Text>
            </View>
        </View>

        {/* Lines */}
        <View style={styles.lineThick} />
        <View style={styles.lineThin} />

        {/* Title */}
        <View style={styles.docTitleBox}>
            <Text style={styles.docTitleText}>TANDA BUKTI PENDAFTARAN</Text>
        </View>

        {/* content split */}
        <View style={styles.rowContainer}>
            
            {/* LEFT COLUMN: DATA */}
            <View style={styles.leftCol}>
                
                {/* SECTION A: DATA SISWA */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderBox}>
                        <Text style={styles.sectionHeaderText}>A. Data Calon Peserta Didik</Text>
                    </View>
                    <View style={styles.sectionContentBox}>
                         <View style={styles.tableRow}>
                            <Text style={styles.labelCell}>No. Pendaftaran</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCellBlue}>{data.registrationNumber}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.labelCell}>Nama Lengkap</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={[styles.valueCell, { textTransform: 'uppercase' }]}>{data.fullName}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.labelCell}>NIK</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCell}>{data.studentNik}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.labelCell}>Tempat, Tanggal Lahir</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCell}>{data.birthPlace}, {format(data.birthDate, "dd MMMM yyyy", { locale: idLocale })}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.labelCell}>Jenis Kelamin</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCell}>{data.gender === "L" ? "Laki-laki" : "Perempuan"}</Text>
                        </View>
                        <View style={styles.tableRowPlain}>
                            <Text style={styles.labelCell}>Sekolah Asal</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCell}>{data.previousSchool || "-"}</Text>
                        </View>
                    </View>
                </View>

                {/* SECTION B: DOMISILI */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderBox}>
                        <Text style={styles.sectionHeaderText}>B. Domisili</Text>
                    </View>
                    <View style={styles.sectionContentBox}>
                        <View style={styles.tableRow}>
                            <Text style={styles.labelCell}>Alamat Lengkap</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCell}>{data.address}</Text>
                        </View>
                        <View style={styles.tableRowPlain}>
                            <Text style={styles.labelCell}>Jarak ke Sekolah</Text>
                            <Text style={styles.colonCell}>:</Text>
                            <Text style={styles.valueCell}>{data.distanceToSchool ? `${data.distanceToSchool.toFixed(2)} km` : '-'}</Text>
                        </View>
                    </View>
                </View>

            </View>

            {/* RIGHT COLUMN: SIDEBAR */}
            <View style={styles.rightCol}>
                <View style={styles.sidebarBox}>
                     <View style={styles.photoFrame}>
                        <Text style={{ fontSize: 8 }}>FOTO 3x4</Text>
                     </View>
                     <Text style={{ fontSize: 8, fontStyle: 'italic', textAlign: 'center', color: '#6b7280', marginBottom: 20 }}>
                        Tempel pas foto {'\n'}terbaru di sini
                     </Text>
                     
                     <View style={{ width: '100%', height: 1, backgroundColor: '#e5e7eb' }} />

                     <View style={styles.qrFrame}>
                        {data.qrCodeUrl && <Image src={data.qrCodeUrl} style={{ width: 90, height: 90 }} />}
                     </View>
                     <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', marginBottom: 2 }}>{data.registrationNumber}</Text>
                     <Text style={{ fontSize: 8, color: '#6b7280' }}>Scan untuk validasi data</Text>
                </View>
            </View>

        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>Catatan Penting:</Text>
            <Text style={styles.disclaimerText}>• Bukti pendaftaran ini harap dibawa saat melakukan verifikasi ulang di sekolah.</Text>
            <Text style={styles.disclaimerText}>• Pantau pengumuman status penerimaan melalui website resmi sekolah atau papan pengumuman.</Text>
            <Text style={styles.disclaimerText}>• Data yang tidak sesuai dengan dokumen asli dapat menggugurkan status penerimaan.</Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureRow}>
            <View>
                <Text style={styles.metaText}>Doc ID: {data.id.split('-')[0]}</Text>
                <Text style={styles.metaText}>Printed: {format(new Date(), "dd/MM/yyyy HH:mm")}</Text>
            </View>
            <View style={styles.signColumn}>
                <Text style={{ fontSize: 11, marginBottom: 2, fontFamily: 'Helvetica' }}>Indramayu, {format(data.createdAt || new Date(), "dd MMMM yyyy", { locale: idLocale })}</Text>
                <Text style={{ fontSize: 11, color: '#4b5563', fontFamily: 'Helvetica-Bold' }}>Panitia PPDB,</Text>
                <View style={styles.signGap} />
                <View style={styles.signLine} />
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>Panitia Penerimaan</Text>
            </View>
        </View>

      </Page>
    </Document>
  );
};
