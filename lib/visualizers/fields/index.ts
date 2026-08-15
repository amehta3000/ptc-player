/**
 * Particle Field registry
 *
 * Add a new field by importing it and appending it to PARTICLE_FIELDS. The
 * order here is the order of the "Field" slider in the UI, and the index is
 * what share links store — append new fields to the end so old links keep
 * pointing at the same field.
 */

import { ParticleField } from './types';
// import { spectralHelix } from './spectralHelix';
import { torusInterference } from './torusInterference';
import { jellyFish } from './jellyfish';
import { tesseract } from './tesseract';
// 

export const PARTICLE_FIELDS: ParticleField[] = [
  // spectralHelix,
  torusInterference,
  jellyFish,
  tesseract,
  // nestedVessels,
];

export const PARTICLE_FIELD_NAMES: string[] = PARTICLE_FIELDS.map((f) => f.name);

export type { ParticleField, FieldContext, FieldAttr, FieldControlSpec } from './types';
