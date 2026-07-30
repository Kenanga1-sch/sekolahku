package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

type GTKDetail struct {
	NIP, Gender, TTL, Gol, Status, Pendidikan, TglMengabdi, TmtCpns, TmtGol, NRG, NUPTK, Mengajar, JPL string
}

var gtkStaticDetails = map[string]GTKDetail{
	"197702062014081001": {"197702062014081001", "L", "Indramayu, 06-02-1977", "III/c", "PNS", "S-1", "7/1/2002", "01-08-2014", "01-04-2022", "150261115253", "5538755657200012", "-", "-"},
	"196706272008012004": {"196706272008012004", "P", "Indramayu, 27-06-1967", "III/d", "PNS", "S-1", "6/1/2003", "01-01-2008", "01-04-2023", "130271973063", "1959745648300042", "Kelas", "24"},
	"198406152024212001": {"198406152024212001", "P", "Indramayu, 15-06-1984", "IX", "PPPK", "S-1", "7/16/2006", "01-02-2024", "01-02-2024", "240271388303", "394762663300092", "Kelas", "24"},
	"199409252024212009": {"199409252024212009", "P", "Indramayu, 25-09-1994", "IX", "PPPK", "S-1", "10/1/2016", "01-02-2024", "01-02-2024", "-", "7257772673130023", "Kelas", "24"},
	"198802242024212008": {"198802242024212008", "P", "Indramayu, 24-02-1988", "IX", "PPPK", "S-1", "2/1/2024", "01-02-2024", "01-02-2024", "-", "6556766666300012", "Kelas", "24"},
	"199503172025212118": {"199503172025212118", "L", "Indramayu, 17-03-1995", "IX", "PPPK PW", "S-1", "1/1/2021", "01-11-2025", "01-11-2025", "-", "4649773674230202", "Kelas", "24"},
	"199809152025211065": {"199809152025211065", "L", "Indramayu, 15-09-1998", "IX", "PPPK PW", "S-1", "11/24/2021", "01-11-2025", "01-11-2025", "-", "4247776677130063", "PAI", "24"},
	"199809152025211000": {"199809152025211000", "L", "Indramayu, 15-09-1998", "IX", "PPPK PW", "S-1", "11/24/2021", "01-11-2025", "01-11-2025", "-", "4247776677130063", "PAI", "24"},
	"199903092025211053": {"199903092025211053", "L", "Indramayu, 09-03-1999", "-", "PPPK PW", "SMK", "2/22/2021", "01-11-2025", "01-11-2025", "-", "9641777678130032", "-", "-"},
	"199210152025211110": {"199210152025211110", "L", "Indramayu, 15-10-1992", "-", "PPPK PW", "PAKET C", "11/1/2017", "01-11-2025", "01-11-2025", "-", "6347770671130273", "-", "-"},
}

func (h *EOfficeHandler) GetDaftar1Stats(c echo.Context) error {
	monthStr := c.QueryParam("month")
	yearStr := c.QueryParam("year")
	now := time.Now()
	reportMonth, reportYear := int(now.Month()), now.Year()
	if m, err := strconv.Atoi(monthStr); err == nil && m >= 1 && m <= 12 {
		reportMonth = m
	}
	if y, err := strconv.Atoi(yearStr); err == nil && y > 1900 {
		reportYear = y
	}

	monthNames := []string{"", "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"}

	var schoolName, schoolNpsn, schoolAddress, principalName, principalNip, academicYear string
	h.Repo.DB.QueryRow(`SELECT COALESCE(school_name,''),COALESCE(school_npsn,''),COALESCE(school_address,''),COALESCE(principal_name,''),COALESCE(principal_nip,''),COALESCE(current_academic_year,'') FROM school_settings LIMIT 1`).Scan(&schoolName, &schoolNpsn, &schoolAddress, &principalName, &principalNip, &academicYear)

	monthStrFmt := fmt.Sprintf("%02d", reportMonth)
	yearStrFmt := fmt.Sprintf("%d", reportYear)

	type ck struct{ Grade int; Gender string }
	active := make(map[ck]int)
	rows, _ := h.Repo.DB.Query(`SELECT c.grade,s.gender,COUNT(*) FROM students s JOIN student_classes c ON s.class_id=c.id WHERE s.status='active' GROUP BY c.grade,s.gender`)
	for rows != nil && rows.Next() {
		var g int; var gen string; var c int
		if rows.Scan(&g, &gen, &c) == nil {
			active[ck{g, strings.ToUpper(gen)}] = c
		}
	}
	if rows != nil { rows.Close() }

	masuk := make(map[ck]int)
	rows, _ = h.Repo.DB.Query(`SELECT target_grade,gender,COUNT(*) FROM mutasi_requests WHERE status_approval='approved' AND strftime('%m',datetime(updated_at/1000,'unixepoch'))=? AND strftime('%Y',datetime(updated_at/1000,'unixepoch'))=? GROUP BY target_grade,gender`, monthStrFmt, yearStrFmt)
	for rows != nil && rows.Next() {
		var g int; var gen string; var c int
		if rows.Scan(&g, &gen, &c) == nil {
			masuk[ck{g, strings.ToUpper(gen)}] = c
		}
	}
	if rows != nil { rows.Close() }

	keluar := make(map[ck]int)
	rows, _ = h.Repo.DB.Query(`SELECT c.grade,s.gender,COUNT(*) FROM mutasi_out_requests m JOIN students s ON m.student_id=s.id JOIN student_classes c ON s.class_id=c.id WHERE m.status='completed' AND strftime('%m',datetime(COALESCE(m.completed_at,m.updated_at)/1000,'unixepoch'))=? AND strftime('%Y',datetime(COALESCE(m.completed_at,m.updated_at)/1000,'unixepoch'))=? GROUP BY c.grade,s.gender`, monthStrFmt, yearStrFmt)
	for rows != nil && rows.Next() {
		var g int; var gen string; var c int
		if rows.Scan(&g, &gen, &c) == nil {
			keluar[ck{g, strings.ToUpper(gen)}] = c
		}
	}
	if rows != nil { rows.Close() }

	td := map[string]interface{}{
		"bulan": monthNames[reportMonth] + " " + strconv.Itoa(reportYear),
		"tahun_pelajaran": academicYear, "sekolah_nama": schoolName, "sekolah_npsn": schoolNpsn,
		"sekolah_alamat": schoolAddress, "kepala_sekolah_nama": principalName, "kepala_sekolah_nip": principalNip,
		"pengawas_nama": "H. Taryani, S.Pd., M.MP.d", "pengawas_nip": "197004141992031005",
	}

	lastDay := 31
	if reportMonth == 4 || reportMonth == 6 || reportMonth == 9 || reportMonth == 11 { lastDay = 30 } else if reportMonth == 2 { lastDay = 28; if reportYear%4 == 0 && (reportYear%100 != 0 || reportYear%400 == 0) { lastDay = 29 } }
	td["tanggal_laporan"] = "Indramayu, " + strconv.Itoa(lastDay) + " " + monthNames[reportMonth] + " " + strconv.Itoa(reportYear)

	var tLL, tLP, tML, tMP, tKL, tKP, tAL, tAP int
	roman := map[int]string{1: "i", 2: "ii", 3: "iii", 4: "iv", 5: "v", 6: "vi"}
	for g := 1; g <= 6; g++ {
		var cLL, cLP, cML, cMP, cKL, cKP, cAL, cAP int
		for _, gen := range []string{"L", "P"} {
			k := ck{g, gen}
			a := active[k]; m := masuk[k]; kl := keluar[k]
			l := a - m + kl; if l < 0 { l = 0 }
			ak := l + m - kl; if ak < 0 { ak = 0 }
			if gen == "L" { cLL, cML, cKL, cAL = l, m, kl, ak; tLL += l; tML += m; tKL += kl; tAL += ak } else { cLP, cMP, cKP, cAP = l, m, kl, ak; tLP += l; tMP += m; tKP += kl; tAP += ak }
		}
		r := roman[g]
		td["m_"+r+"_l_lalu"], td["m_"+r+"_p_lalu"], td["m_"+r+"_t_lalu"] = cLL, cLP, cLL+cLP
		td["m_"+r+"_l_masuk"], td["m_"+r+"_p_masuk"], td["m_"+r+"_t_masuk"] = cML, cMP, cML+cMP
		td["m_"+r+"_l_keluar"], td["m_"+r+"_p_keluar"], td["m_"+r+"_t_keluar"] = cKL, cKP, cKL+cKP
		td["m_"+r+"_l_akhir"], td["m_"+r+"_p_akhir"], td["m_"+r+"_t_akhir"] = cAL, cAP, cAL+cAP
	}
	td["m_t_l_lalu"], td["m_t_p_lalu"], td["m_t_t_lalu"] = tLL, tLP, tLL+tLP
	td["m_t_l_masuk"], td["m_t_p_masuk"], td["m_t_t_masuk"] = tML, tMP, tML+tMP
	td["m_t_l_keluar"], td["m_t_p_keluar"], td["m_t_t_keluar"] = tKL, tKP, tKL+tKP
	td["m_t_l_akhir"], td["m_t_p_akhir"], td["m_t_t_akhir"] = tAL, tAP, tAL+tAP

	// Age stats
	ageKeys := []string{"under5", "6", "7", "8", "9", "10", "11", "12", "over13"}
	for _, ak := range ageKeys {
		for g := 1; g <= 6; g++ { gs := strconv.Itoa(g); td["u_"+ak+"_"+gs+"_l"] = 0; td["u_"+ak+"_"+gs+"_p"] = 0; td["u_"+ak+"_"+gs+"_t"] = 0 }
		td["u_"+ak+"_t_l"], td["u_"+ak+"_t_p"], td["u_"+ak+"_t_t"] = 0, 0, 0
	}
	reportDate := time.Date(reportYear, time.Month(reportMonth), lastDay, 23, 59, 59, 0, time.Local)
	rows, _ = h.Repo.DB.Query(`SELECT c.grade,s.gender,s.birth_date FROM students s JOIN student_classes c ON s.class_id=c.id WHERE s.status='active' AND s.birth_date IS NOT NULL AND s.birth_date!=''`)
	for rows != nil && rows.Next() {
		var g int; var gen, bd string
		if rows.Scan(&g, &gen, &bd) == nil {
			if b, e := time.Parse("2006-01-02", bd); e == nil {
				age := reportDate.Year() - b.Year()
				if reportDate.Month() < b.Month() || (reportDate.Month() == b.Month() && reportDate.Day() < b.Day()) { age-- }
				var ak string
				if age < 6 { ak = "under5" } else if age > 12 { ak = "over13" } else { ak = strconv.Itoa(age) }
				gs, genL := strconv.Itoa(g), strings.ToLower(gen)
				td["u_"+ak+"_"+gs+"_"+genL] = td["u_"+ak+"_"+gs+"_"+genL].(int) + 1
				td["u_"+ak+"_"+gs+"_t"] = td["u_"+ak+"_"+gs+"_t"].(int) + 1
				td["u_"+ak+"_t_"+genL] = td["u_"+ak+"_t_"+genL].(int) + 1
				td["u_"+ak+"_t_t"] = td["u_"+ak+"_t_t"].(int) + 1
			}
		}
	}
	if rows != nil { rows.Close() }

	// Religion stats
	religions := []string{"islam", "katolik", "protestan", "hindu", "budha"}
	for _, rk := range religions {
		for g := 1; g <= 6; g++ { gs := strconv.Itoa(g); td["r_"+rk+"_"+gs+"_l"] = 0; td["r_"+rk+"_"+gs+"_p"] = 0; td["r_"+rk+"_"+gs+"_t"] = 0 }
		td["r_"+rk+"_t_l"], td["r_"+rk+"_t_p"], td["r_"+rk+"_t_t"] = 0, 0, 0
	}
	rows, _ = h.Repo.DB.Query(`SELECT c.grade,s.gender,COALESCE(s.religion,'Islam') FROM students s JOIN student_classes c ON s.class_id=c.id WHERE s.status='active'`)
	for rows != nil && rows.Next() {
		var g int; var gen, rel string
		if rows.Scan(&g, &gen, &rel) == nil {
			rel = strings.ToLower(strings.TrimSpace(rel))
			if rel == "" { rel = "islam" }
			if rel != "islam" && rel != "katolik" && rel != "protestan" && rel != "hindu" && rel != "budha" { rel = "islam" }
			gs, genL := strconv.Itoa(g), strings.ToLower(gen)
			td["r_"+rel+"_"+gs+"_"+genL] = td["r_"+rel+"_"+gs+"_"+genL].(int) + 1
			td["r_"+rel+"_"+gs+"_t"] = td["r_"+rel+"_"+gs+"_t"].(int) + 1
			td["r_"+rel+"_t_"+genL] = td["r_"+rel+"_t_"+genL].(int) + 1
			td["r_"+rel+"_t_t"] = td["r_"+rel+"_t_t"].(int) + 1
		}
	}
	if rows != nil { rows.Close() }

	// Inventory stats
	type ii struct{ B, S, R int }
	invDef := map[string]ii{"bangku": {}, "meja_murid": {65, 37, 8}, "kursi_murid": {178, 24, 16}, "lemari": {0, 12, 0}, "meja_guru": {10, 1, 3}, "kursi_guru": {10, 10, 2}, "papan_tulis": {5, 2, 0}, "kursi_tamu": {0, 1, 0}, "rak_buku_loker": {4, 1, 0}, "sound_system": {7, 1, 0}, "komputer": {2, 7, 2}}
	dbInv := make(map[string]ii)
	rows, _ = h.Repo.DB.Query(`SELECT name,SUM(condition_good),SUM(condition_light_damaged),SUM(condition_heavy_damaged) FROM inventory_assets WHERE status='ACTIVE' GROUP BY name`)
	for rows != nil && rows.Next() {
		var n string; var gd, lt, hv int
		if rows.Scan(&n, &gd, &lt, &hv) == nil {
			dbInv[strings.ToLower(strings.TrimSpace(n))] = ii{gd, lt, hv}
		}
	}
	if rows != nil { rows.Close() }
	for key, def := range invDef {
		b, s, r := def.B, def.S, def.R
		if dv, ok := dbInv[key]; ok { b, s, r = dv.B, dv.S, dv.R }
		td["i_"+key+"_baik"], td["i_"+key+"_sedang"], td["i_"+key+"_rusak"], td["i_"+key+"_jumlah"] = b, s, r, b+s+r
	}

	td["t_luas"], td["t_persil"], td["t_tahun"], td["t_harga"] = "3.000", "-", "2013", "Wakaf"
	td["b_baik"], td["b_rusak"], td["b_jumlah"], td["b_sewa"] = 3, 11, 14, "-"
	td["rd_sd_p"], td["rd_sd_sp"], td["rd_sd_dr"], td["rd_sd_tahun"], td["rd_sd_harga"] = "1", "-", "-", "1998", "-"
	td["rd_guru_p"], td["rd_guru_sp"], td["rd_guru_dr"], td["rd_guru_tahun"], td["rd_guru_harga"] = "2", "-", "-", "-", "-"
	td["rd_penjaga_p"], td["rd_penjaga_sp"], td["rd_penjaga_dr"], td["rd_penjaga_tahun"], td["rd_penjaga_harga"] = "-", "-", "-", "-", "-"
	td["rd_lain_p"], td["rd_lain_sp"], td["rd_lain_dr"], td["rd_lain_tahun"], td["rd_lain_harga"] = "-", "-", "-", "-", "-"
	td["air_bersih"], td["hari_efektif"] = "Ledeng", 20

	type GTKRow struct {
		No int `json:"no"`; Nama, Nip, Gender, TTL, Gol, Status, Pendidikan, TglMengabdi, TmtCpns, TmtGol, NRG, NUPTK, Mengajar, JPL string `json:",omitempty"`
	}
	var gtkList []GTKRow
	var nKep, nGKelas, nInggris, nPenjas, nAgama, nOp, nPenjaga int
	rows, _ = h.Repo.DB.Query(`SELECT name,nip,position,category,COALESCE(degree,'') FROM staff_profiles WHERE is_active=1 ORDER BY display_order ASC`)
	if rows != nil {
		idx := 1
		for rows.Next() {
			var nm, np, pos, cat, deg string
			if rows.Scan(&nm, &np, &pos, &cat, &deg) == nil {
				gtk := GTKRow{No: idx, Nama: nm, Nip: np, Pendidikan: deg}
				if gtk.Pendidikan == "" { gtk.Pendidikan = "S-1" }
				if s, ok := gtkStaticDetails[np]; ok { gtk.Gender, gtk.TTL, gtk.Gol, gtk.Status, gtk.Pendidikan, gtk.TglMengabdi, gtk.TmtCpns, gtk.TmtGol, gtk.NRG, gtk.NUPTK, gtk.Mengajar, gtk.JPL = s.Gender, s.TTL, s.Gol, s.Status, s.Pendidikan, s.TglMengabdi, s.TmtCpns, s.TmtGol, s.NRG, s.NUPTK, s.Mengajar, s.JPL }
				gtk.Status = orDefault(gtk.Status, "Honorer")
				pl, cl := strings.ToLower(pos), strings.ToLower(cat)
				switch {
				case cl == "kepsek" || strings.Contains(pl, "kepala sekolah"): nKep++
				case strings.Contains(pl, "guru kelas") || strings.Contains(pl, "kelas"): nGKelas++
				case strings.Contains(pl, "inggris"): nInggris++
				case strings.Contains(pl, "penjas") || strings.Contains(pl, "pjok") || strings.Contains(pl, "olahraga"): nPenjas++
				case strings.Contains(pl, "agama") || strings.Contains(pl, "pai"): nAgama++
				case strings.Contains(pl, "operator"): nOp++
				case strings.Contains(pl, "penjaga") || cl == "support": nPenjaga++
				}
				if deg != "" { gtk.Nama = nm + ", " + deg }
				gtkList = append(gtkList, gtk); idx++
			}
		}
		rows.Close()
	}
	td["g_kepsek"], td["g_guru_kelas"], td["g_inggris"], td["g_penjas"], td["g_agama"], td["g_operator"], td["g_penjaga"], td["g_jumlah"] = nKep, nGKelas, nInggris, nPenjas, nAgama, nOp, nPenjaga, nKep+nGKelas+nInggris+nPenjas+nAgama+nOp+nPenjaga
	td["gtk_list"] = gtkList

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": td})
}

func orDefault(s, def string) string { if s == "" { return def }; return s }
