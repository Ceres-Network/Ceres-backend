import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { PolicyStatusSchema, ReadingTypeSchema } from '@ceres/shared/types';

describe('Input Validation', () => {
  it('should validate policy status enum', () => {
    expect(() => PolicyStatusSchema.parse('active')).not.toThrow();
    expect(() => PolicyStatusSchema.parse('triggered')).not.toThrow();
    expect(() => PolicyStatusSchema.parse('expired')).not.toThrow();
    expect(() => PolicyStatusSchema.parse('invalid')).toThrow();
  });

  it('should validate reading type enum', () => {
    expect(() => ReadingTypeSchema.parse('rainfall')).not.toThrow();
    expect(() => ReadingTypeSchema.parse('ndvi')).not.toThrow();
    expect(() => ReadingTypeSchema.parse('soil_moisture')).not.toThrow();
    expect(() => ReadingTypeSchema.parse('invalid')).toThrow();
  });

  it('should validate farmer address format', () => {
    const addressSchema = z.string().length(56);
    
    expect(() => addressSchema.parse('G'.repeat(56))).not.toThrow();
    expect(() => addressSchema.parse('G'.repeat(55))).toThrow();
    expect(() => addressSchema.parse('G'.repeat(57))).toThrow();
  });

  it('should validate pagination parameters', () => {
    const paginationSchema = z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive().max(100),
    });

    expect(() => paginationSchema.parse({ page: 1, limit: 20 })).not.toThrow();
    expect(() => paginationSchema.parse({ page: 0, limit: 20 })).toThrow();
    expect(() => paginationSchema.parse({ page: 1, limit: 101 })).toThrow();
  });
});
