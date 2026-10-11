package repository

import "math"

const earthRadiusM = 6371000.0 // rata-rata radius bumi dalam meter

// haversineM menghitung jarak lingkaran besar antara dua koordinat dalam meter.
// Murni & tanpa dependensi supaya mudah diuji.
func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180.0
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusM * c
}

// withinRadius melaporkan apakah jarak (meter) berada dalam toleransi radius.
func withinRadius(distanceM float64, radiusM int) bool {
	if radiusM <= 0 {
		return true // radius tak dibatasi
	}
	return distanceM <= float64(radiusM)
}
