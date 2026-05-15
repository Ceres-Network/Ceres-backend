import { describe, it, expect } from 'vitest';
import { geohashDecode, getGeohashCentroid } from '../geo';

describe('Geohash Utilities', () => {
  it.skip('should decode geohash to coordinates', () => {
    const coords = geohashDecode('u4pruyd');
    
    expect(coords.latitude).toBeCloseTo(57.64911, 2);
    expect(coords.longitude).toBeCloseTo(10.40744, 2);
  });

  it.skip('should decode single character geohash', () => {
    const coords = geohashDecode('u');
    
    expect(coords.latitude).toBeGreaterThan(45);
    expect(coords.latitude).toBeLessThanOrEqual(67.5);
    expect(coords.longitude).toBeGreaterThan(0);
    expect(coords.longitude).toBeLessThanOrEqual(22.5);
  });

  it.skip('should throw error on invalid geohash character', () => {
    expect(() => geohashDecode('invalid!')).toThrow('Invalid geohash character');
  });

  it.skip('should return centroid coordinates', () => {
    const centroid = getGeohashCentroid('u4pruyd');
    
    expect(centroid).toHaveProperty('latitude');
    expect(centroid).toHaveProperty('longitude');
    expect(typeof centroid.latitude).toBe('number');
    expect(typeof centroid.longitude).toBe('number');
  });

  it.skip('should handle longer geohashes with more precision', () => {
    const short = geohashDecode('u4p');
    const long = geohashDecode('u4pruydqqvj');
    
    // Longer geohash should be in same general area but more precise
    expect(Math.abs(short.latitude - long.latitude)).toBeLessThan(1);
    expect(Math.abs(short.longitude - long.longitude)).toBeLessThan(1);
  });
});
