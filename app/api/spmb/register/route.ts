import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, sanitizeString, sanitizeEmail, sanitizePhone, sanitizeNIK } from "@/lib/security";
import { db } from "@/db";
import { 
    getActivePeriod,
    getRegistrantByNik,
    generateRegistrationNumber,
    createRegistrant,
} from "@/lib/spmb";
import { 
    ValidationError, 
    RateLimitError, 
    ConflictError, 
    NotFoundError,
    createErrorResponse 
} from "@/lib/errors";
import { spmbLog, generateRequestId, timeStart, timeEnd } from "@/lib/logger";
import { broadcastNotification } from "@/lib/notifications";
import { NewSPMBRegistrant } from "@/db/schema/spmb";
import { schoolSettings } from "@/db/schema/misc";
import { siteConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    try {
        // Rate limiting - 10 registrations per IP per hour
        const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const rateCheck = checkRateLimit(`register:${clientIp}`, {
            windowMs: 60 * 60 * 1000, // 1 hour
            maxRequests: 10
        });

        if (!rateCheck.allowed) {
            throw new RateLimitError(Math.ceil(rateCheck.resetIn / 1000));
        }

        const body = await request.json();

        spmbLog.info("Registration attempt", { 
            requestId, 
            action: "registration_start",
            ip: clientIp.split(",")[0] 
        });

        // Parse and validate with Zod
        const parseResult = await import("@/lib/validations/spmb").then(m => m.registerApiSchema.safeParseAsync(body));

        if (!parseResult.success) {
            const missingFields: Record<string, string> = {};
            // Defensive: ensure errors array exists
            const errors = (parseResult.error as any)?.errors || [];
            if (Array.isArray(errors)) {
                errors.forEach(err => {
                    const field = err.path.join(".");
                    missingFields[field] = err.message;
                });
            } else {
                console.error("Zod Validation Failed but no errors array:", parseResult.error);
                missingFields["unknown"] = "Data tidak valid (reason unknown)";
            }
            
            console.log("Validation missing fields:", missingFields); // DEBUG LOG
            throw new ValidationError("Data pendaftaran tidak valid", missingFields);
        }

        const validData = parseResult.data;

        // Check if NIK already registered
        const existing = await getRegistrantByNik(sanitizeNIK(validData.student_nik));
        if (existing) {
            throw new ConflictError("NIK Siswa sudah terdaftar sebelumnya");
        }

        // Get active SPMB period
        const activePeriod = await getActivePeriod();
        if (!activePeriod) {
            throw new NotFoundError("Periode SPMB belum dibuka");
        }

        // Generate registration number
        const registrationNumber = await generateRegistrationNumber();

        // Fetch max distance from settings
        let maxDistance: number = siteConfig.location.maxDistanceKm;
        try {
            const [settings] = await db.select().from(schoolSettings).limit(1);
            if (settings?.maxDistanceKm) {
                maxDistance = settings.maxDistanceKm;
            }
        } catch (e) {
            console.error("Failed to fetch max distance setting, using default", e);
        }
        
        const isInZone = validData.distance_to_school <= maxDistance;

        // Prepare Data for DB Insertion
        // Map snake_case (validData) to camelCase (Drizzle)
        
        // Determine primary parent name for legacy/contact purposes
        const primaryParentName = validData.father_name || validData.mother_name || validData.guardian_name || validData.parent_name || "-";

        const newRegistrantData: NewSPMBRegistrant = {
            periodId: activePeriod.id,
            registrationNumber: registrationNumber,
            
            // Student
            fullName: sanitizeString(validData.full_name), // This will map to full_name col
            nisn: sanitizeString(validData.nisn || ""),
            studentNik: sanitizeNIK(validData.student_nik),
            kkNumber: sanitizeNIK(validData.kk_number),
            birthCertificateNo: sanitizeString(validData.birth_certificate_no || ""),
            birthDate: new Date(validData.birth_date),
            birthPlace: sanitizeString(validData.birth_place),
            gender: validData.gender,
            religion: sanitizeString(validData.religion),
            specialNeeds: sanitizeString(validData.special_needs),
            livingArrangement: sanitizeString(validData.living_arrangement),
            transportMode: sanitizeString(validData.transport_mode),
            childOrder: validData.child_order,
            hasKpsPkh: validData.has_kps_pkh,
            hasKip: validData.has_kip,
            previousSchool: sanitizeString(validData.previous_school || ""),

            // Contact (Legacy & New)
            parentName: sanitizeString(primaryParentName),
            parentPhone: sanitizePhone(validData.parent_phone),
            parentEmail: sanitizeEmail(validData.parent_email || ""),

            // Address Detail
            addressStreet: sanitizeString(validData.address_street),
            addressRt: sanitizeString(validData.address_rt),
            addressRw: sanitizeString(validData.address_rw),
            addressVillage: sanitizeString(validData.address_village),
            postalCode: sanitizeString(validData.postal_code || ""),
            address: sanitizeString(validData.address || `${validData.address_street}, RT ${validData.address_rt}/RW ${validData.address_rw}, ${validData.address_village}`),

            // Parents Detail
            fatherName: sanitizeString(validData.father_name),
            fatherNik: sanitizeNIK(validData.father_nik),
            fatherBirthYear: sanitizeString(validData.father_birth_year),
            fatherEducation: sanitizeString(validData.father_education),
            fatherJob: sanitizeString(validData.father_job),
            fatherIncome: sanitizeString(validData.father_income),

            motherName: sanitizeString(validData.mother_name),
            motherNik: sanitizeNIK(validData.mother_nik),
            motherBirthYear: sanitizeString(validData.mother_birth_year),
            motherEducation: sanitizeString(validData.mother_education),
            motherJob: sanitizeString(validData.mother_job),
            motherIncome: sanitizeString(validData.mother_income),

            guardianName: sanitizeString(validData.guardian_name || ""),
            guardianNik: sanitizeNIK(validData.guardian_nik || ""),
            guardianBirthYear: sanitizeString(validData.guardian_birth_year || ""),
            guardianEducation: sanitizeString(validData.guardian_education || ""),
            guardianJob: sanitizeString(validData.guardian_job || ""),
            guardianIncome: sanitizeString(validData.guardian_income || ""),

            // Location
            homeLat: validData.home_lat,
            homeLng: validData.home_lng,
            distanceToSchool: validData.distance_to_school,
            isInZone: isInZone,
            
            // Meta
            status: "pending",
            studentName: sanitizeString(validData.full_name), // Legacy field
        };

        // Create registrant record
        const registrant = await createRegistrant(newRegistrantData);

        // Notify admins
        await broadcastNotification(["superadmin", "admin"], {
            title: "Pendaftar Baru SPMB",
            message: `${newRegistrantData.fullName} telah mendaftar (No: ${registrationNumber})`,
            type: "success",
            category: "spmb",
            targetUrl: `/admin/spmb/pendaftar/${registrant.id}`,
        });

        const duration = timeEnd(start);
        spmbLog.info("Registration completed", { 
            requestId, 
            action: "registration_success",
            registrationNumber,
            registrantId: registrant.id,
            duration 
        });

        return NextResponse.json({
            success: true,
            data: {
                registration_number: registrationNumber,
                id: registrant.id,
                status: "pending",
                is_in_zone: isInZone,
            },
        });
    } catch (error) {
        const duration = timeEnd(start);
        spmbLog.error("Registration error", { 
            requestId, 
            action: "registration_error",
            duration 
        }, error as Error);
        
        return createErrorResponse(error);
    }
}
