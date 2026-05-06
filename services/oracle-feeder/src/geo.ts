import type { GeohashCoordinates } from '@ceres/shared/types';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Decode a geohash string to its centroid latitude/longitude coordinates
 */
export function geohashDecode(geohash: string): GeohashCoordinates {
  let isEven = true;
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  for (let i = 0; i < geohash.length; i++) {
    const char = geohash[i];
    const charIndex = BASE32.indexOf(char);
    
    if (charIndex === -1) {
      throw new Error(`Invalid geohash character: ${char}`);
    }

    for (let j = 4; j >= 0; j--) {
      const bit = (charIndex >> j) & 1;
      
      if (isEven) {
        // Longitude
        const lonMid = (lonMin + lonMax) / 2;
        if (bit === 1) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        // Latitude
        const latMid = (latMin + latMax) / 2;
        if (bit === 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      
      isEven = !isEven;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
  };
}

/**
 * Get centroid coordinates for a geohash
 */
export function getGeohashCentroid(geohash: string): GeohashCoordinates {
  return geohashDecode(geohash);
}
