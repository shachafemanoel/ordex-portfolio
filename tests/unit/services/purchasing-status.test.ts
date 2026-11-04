import { validatePOTransition, canEditPO } from '@/lib/services/purchasing/status-machine';
import { describe, expect, it } from 'vitest';

describe('Purchase Order Status Machine', () => {
  describe('validatePOTransition', () => {
    it('should allow DRAFT -> SENT', () => {
      expect(validatePOTransition('DRAFT', 'SENT').allowed).toBe(true);
    });

    it('should allow DRAFT -> CANCELLED', () => {
      expect(validatePOTransition('DRAFT', 'CANCELLED').allowed).toBe(true);
    });

    it('should NOT allow DRAFT -> RECEIVED', () => {
      expect(validatePOTransition('DRAFT', 'RECEIVED').allowed).toBe(false);
    });

    it('should allow SENT -> PARTIALLY_RECEIVED', () => {
      expect(validatePOTransition('SENT', 'PARTIALLY_RECEIVED').allowed).toBe(true);
    });

    it('should allow PARTIALLY_RECEIVED -> RECEIVED', () => {
      expect(validatePOTransition('PARTIALLY_RECEIVED', 'RECEIVED').allowed).toBe(true);
    });

    it('should allow SENT -> DRAFT (correction)', () => {
      expect(validatePOTransition('SENT', 'DRAFT').allowed).toBe(true);
    });

    it('should allow self-transition', () => {
      expect(validatePOTransition('SENT', 'SENT').allowed).toBe(true);
    });
  });

  describe('canEditPO', () => {
    it('should allow editing DRAFT', () => {
      expect(canEditPO('DRAFT')).toBe(true);
    });

    it('should NOT allow editing SENT', () => {
      expect(canEditPO('SENT')).toBe(false);
    });

    it('should NOT allow editing RECEIVED', () => {
      expect(canEditPO('RECEIVED')).toBe(false);
    });
  });
});
