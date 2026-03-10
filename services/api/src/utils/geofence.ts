// import { db } from '../config/database';
// import { logger } from '../config/logger';

// export interface Coordinates {
//   lat: number;
//   lng: number;
// }

// export interface StudentInRange {
//   student_id: string;
//   user_id: string;
//   name: string;
//   roll_number: string;
//   distance_meters: number;
// }

// // ─── HAVERSINE FALLBACK (pure JS) ─────────────────────────────────────────────
// export function haversineDistance(a: Coordinates, b: Coordinates): number {
//   const R = 6371000; // Earth radius in meters
//   const toRad = (deg: number) => (deg * Math.PI) / 180;

//   const dLat = toRad(b.lat - a.lat);
//   const dLng = toRad(b.lng - a.lng);

//   const sinDLat = Math.sin(dLat / 2);
//   const sinDLng = Math.sin(dLng / 2);

//   const a1 =
//     sinDLat * sinDLat +
//     Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

//   const c = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
//   return R * c;
// }

// // ─── POSTGIS GEOFENCE QUERY (primary) ────────────────────────────────────────
// // Returns all enrolled students for a course who are within radius of professor
// export async function getStudentsInGeofence(
//   courseId: string,
//   professorLat: number,
//   professorLng: number,
//   radiusMeters: number
// ): Promise<StudentInRange[]> {
//   try {
//     // PostGIS ST_DWithin on geography type gives accurate great-circle distance
//     const { rows } = await db.query<StudentInRange>(
//       `SELECT
//          s.student_id,
//          s.user_id,
//          s.name,
//          s.roll_number,
//          ROUND(
//            ST_Distance(
//              sl.location::geography,
//              ST_MakePoint($3, $2)::geography
//            )::numeric, 2
//          ) AS distance_meters
//        FROM course_enrollments ce
//        JOIN students s ON s.student_id = ce.student_id
//        JOIN student_locations sl ON sl.student_id = s.student_id
//        WHERE
//          ce.course_id = $1
//          AND sl.updated_at > NOW() - INTERVAL '10 minutes'
//          AND ST_DWithin(
//            sl.location::geography,
//            ST_MakePoint($3, $2)::geography,
//            $4
//          )
//        ORDER BY distance_meters ASC`,
//       [courseId, professorLat, professorLng, radiusMeters]
//     );

//     return rows;
//   } catch (err: any) {
//     // PostGIS not available — fallback to Haversine in application layer
//     logger.warn('PostGIS query failed, using Haversine fallback:', err.message);
//     return getStudentsInGeofenceFallback(
//       courseId,
//       professorLat,
//       professorLng,
//       radiusMeters
//     );
//   }
// }

// // ─── HAVERSINE FALLBACK ───────────────────────────────────────────────────────
// async function getStudentsInGeofenceFallback(
//   courseId: string,
//   professorLat: number,
//   professorLng: number,
//   radiusMeters: number
// ): Promise<StudentInRange[]> {
//   // Fetch all enrolled students with recent locations
//   const { rows } = await db.query<any>(
//     `SELECT
//        s.student_id,
//        s.user_id,
//        s.name,
//        s.roll_number,
//        sl.location_lat,
//        sl.location_lng
//      FROM course_enrollments ce
//      JOIN students s ON s.student_id = ce.student_id
//      JOIN student_locations_raw sl ON sl.student_id = s.student_id
//      WHERE
//        ce.course_id = $1
//        AND sl.updated_at > NOW() - INTERVAL '10 minutes'`,
//     [courseId]
//   );

//   const professorCoords: Coordinates = { lat: professorLat, lng: professorLng };

//   return rows
//     .map((row: any) => ({
//       student_id: row.student_id,
//       user_id: row.user_id,
//       name: row.name,
//       roll_number: row.roll_number,
//       distance_meters: haversineDistance(professorCoords, {
//         lat: parseFloat(row.location_lat),
//         lng: parseFloat(row.location_lng)
//       })
//     }))
//     .filter((s: StudentInRange) => s.distance_meters <= radiusMeters)
//     .sort((a: StudentInRange, b: StudentInRange) => a.distance_meters - b.distance_meters);
// }

// // ─── GET ALL ENROLLED (for grace period students) ─────────────────────────────
// // Students whose location ping is stale (5-10 min) — included with flag
// export async function getAllEnrolledStudents(courseId: string): Promise<{
//   student_id: string;
//   user_id: string;
//   name: string;
//   roll_number: string;
//   location_stale: boolean;
// }[]> {
//   const { rows } = await db.query(
//     `SELECT
//        s.student_id,
//        s.user_id,
//        s.name,
//        s.roll_number,
//        CASE
//          WHEN sl.updated_at IS NULL THEN TRUE
//          WHEN sl.updated_at < NOW() - INTERVAL '5 minutes' THEN TRUE
//          ELSE FALSE
//        END AS location_stale
//      FROM course_enrollments ce
//      JOIN students s ON s.student_id = ce.student_id
//      LEFT JOIN student_locations sl ON sl.student_id = s.student_id
//      WHERE ce.course_id = $1`,
//     [courseId]
//   );
//   return rows;
// }
















import { db } from '../config/database';
import { logger } from '../config/logger';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface StudentInRange {
  student_id: string;
  user_id: string;
  name: string;
  roll_number: string;
  distance_meters: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

// ─── ULTRA-ACCURATE VINCENTY FORMULA (pure JS Fallback) ──────────────────────
// Replaces Haversine. Models the Earth as an oblate spheroid (WGS-84).
// Accuracy: ~0.5 millimeters.
export function exactEllipsoidalDistance(coord1: Coordinates, coord2: Coordinates): number {
  const a = 6378137.0; // WGS-84 semi-major axis in meters
  const b = 6356752.314245; // WGS-84 semi-minor axis in meters
  const f = 1 / 298.257223563; // WGS-84 flattening

  const L = toRad(coord2.lng - coord1.lng);
  const U1 = Math.atan((1 - f) * Math.tan(toRad(coord1.lat)));
  const U2 = Math.atan((1 - f) * Math.tan(toRad(coord2.lat)));

  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP = 2 * Math.PI;
  let iterLimit = 100; // Iteration limit for convergence
  let sinLambda = 0, cosLambda = 0, sinSigma = 0, cosSigma = 0, sigma = 0, sinAlpha = 0;
  let cosSqAlpha = 0, cos2SigmaM = 0;

  // Iterate until the change in lambda is negligible (highly accurate convergence)
  while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) * (cosU2 * sinLambda) +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
    );
    
    if (sinSigma === 0) return 0; // Co-incident points (distance is 0)

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha === 0 ? 0 : cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;

    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * f * sinAlpha *
      (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  }

  if (iterLimit === 0) {
    // Vincenty fails to converge for nearly antipodal points (opposite sides of the Earth).
    // In a geofencing app this will never realistically happen, but we fallback to Haversine just in case.
    return fallbackHaversine(coord1, coord2);
  }

  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
    B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  const distance = b * A * (sigma - deltaSigma);
  return distance; 
}

// Basic Haversine only used if Vincenty fails to converge (extreme edge case)
function fallbackHaversine(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const a1 = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
}

// ─── POSTGIS GEOFENCE QUERY (primary) ────────────────────────────────────────
export async function getStudentsInGeofence(
  courseId: string,
  professorLat: number,
  professorLng: number,
  radiusMeters: number
): Promise<StudentInRange[]> {
  try {
    // Note: Added ", true" to ST_Distance and ST_DWithin. 
    // This strictly forces PostGIS to use the WGS-84 Spheroid math instead of a sphere.
    const { rows } = await db.query<StudentInRange>(
      `SELECT
         s.student_id,
         s.user_id,
         s.name,
         s.roll_number,
         ROUND(
           ST_Distance(
             sl.location::geography,
             ST_MakePoint($3, $2)::geography,
             true
           )::numeric, 3
         ) AS distance_meters
       FROM course_enrollments ce
       JOIN students s ON s.student_id = ce.student_id
       JOIN student_locations sl ON sl.student_id = s.student_id
       WHERE
         ce.course_id = $1
         AND sl.updated_at > NOW() - INTERVAL '10 minutes'
         AND ST_DWithin(
           sl.location::geography,
           ST_MakePoint($3, $2)::geography,
           $4,
           true
         )
       ORDER BY distance_meters ASC`,
      [courseId, professorLat, professorLng, radiusMeters]
    );

    return rows;
  } catch (err: any) {
    logger.warn('PostGIS query failed, using Vincenty Ellipsoidal fallback:', err.message);
    return getStudentsInGeofenceFallback(
      courseId,
      professorLat,
      professorLng,
      radiusMeters
    );
  }
}

// ─── ELLIPSOIDAL FALLBACK ───────────────────────────────────────────────────────
async function getStudentsInGeofenceFallback(
  courseId: string,
  professorLat: number,
  professorLng: number,
  radiusMeters: number
): Promise<StudentInRange[]> {
  const { rows } = await db.query<any>(
    `SELECT
       s.student_id,
       s.user_id,
       s.name,
       s.roll_number,
       sl.location_lat,
       sl.location_lng
     FROM course_enrollments ce
     JOIN students s ON s.student_id = ce.student_id
     JOIN student_locations_raw sl ON sl.student_id = s.student_id
     WHERE
       ce.course_id = $1
       AND sl.updated_at > NOW() - INTERVAL '10 minutes'`,
    [courseId]
  );

  const professorCoords: Coordinates = { lat: professorLat, lng: professorLng };

  return rows
    .map((row: any) => ({
      student_id: row.student_id,
      user_id: row.user_id,
      name: row.name,
      roll_number: row.roll_number,
      distance_meters: exactEllipsoidalDistance(professorCoords, {
        lat: parseFloat(row.location_lat),
        lng: parseFloat(row.location_lng)
      })
    }))
    .filter((s: StudentInRange) => s.distance_meters <= radiusMeters)
    .sort((a: StudentInRange, b: StudentInRange) => a.distance_meters - b.distance_meters);
}

// ─── GET ALL ENROLLED (for grace period students) ─────────────────────────────
export async function getAllEnrolledStudents(courseId: string): Promise<{
  student_id: string;
  user_id: string;
  name: string;
  roll_number: string;
  location_stale: boolean;
}[]> {
  const { rows } = await db.query(
    `SELECT
       s.student_id,
       s.user_id,
       s.name,
       s.roll_number,
       CASE
         WHEN sl.updated_at IS NULL THEN TRUE
         WHEN sl.updated_at < NOW() - INTERVAL '5 minutes' THEN TRUE
         ELSE FALSE
       END AS location_stale
     FROM course_enrollments ce
     JOIN students s ON s.student_id = ce.student_id
     LEFT JOIN student_locations sl ON sl.student_id = s.student_id
     WHERE ce.course_id = $1`,
    [courseId]
  );
  return rows;
}