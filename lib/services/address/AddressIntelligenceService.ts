import { prisma } from '@/lib/db';
import { isTenantRuntime } from '@/lib/tenancy/context';
import {
  GeocodingProvider,
  GeocodingResult,
  geocodingProvider,
} from '@/lib/services/geocoding/provider';
import { AddressValidationStatus, Prisma } from '@prisma/client';

export interface NormalizedAddressResult {
  addressRaw: string;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  apartment?: string | null;
  formattedAddress?: string | null;
  issues: string[];
  isValid: boolean;
  validationStatus: AddressValidationStatus;
  validationReason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

import { z } from 'zod';

const structuredOutputSchema = z.object({
  city: z.string().nullable(),
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  floor: z.string().nullable(),
  apartment: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  missingParts: z.array(z.string()).nullable().optional(),
  isValid: z.boolean(),
  reason: z.string().nullable().optional(),
});

function buildPrompt(input: {
  addressRaw?: string | null;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  apartment?: string | null;
}): string {
  return (
    `Normalize the following address. Respond **only** with JSON that matches the provided schema.\n\n` +
    `Input may be Hebrew. Extract clean fields and mark missing critical parts (city, street, houseNumber).\n` +
    `If free-text notes are present, ignore them unless relevant to location.\n` +
    `Input:\n` +
    `Raw: ${input.addressRaw || ''}\n` +
    `City: ${input.city || ''}\n` +
    `Street: ${input.street || ''}\n` +
    `House number: ${input.houseNumber || ''}\n` +
    `Floor: ${input.floor || ''}\n` +
    `Apartment: ${input.apartment || ''}`
  );
}

function deriveStatus(result: Omit<NormalizedAddressResult, 'validationStatus'>): {
  validationStatus: AddressValidationStatus;
  validationReason?: string | null;
} {
  if (!result.addressRaw || result.addressRaw.trim().length === 0) {
    return {
      validationStatus: AddressValidationStatus.MISSING,
      validationReason: 'Missing raw address',
    };
  }

  const missingCore = [result.city, result.street, result.houseNumber].filter(
    (part) => !part || `${part}`.trim() === ''
  );
  if (missingCore.length > 0) {
    return {
      validationStatus: AddressValidationStatus.MISSING,
      validationReason: `Missing parts: ${missingCore.join(', ')}`,
    };
  }

  if (!result.isValid) {
    return {
      validationStatus: AddressValidationStatus.SUSPICIOUS,
      validationReason:
        result.validationReason ||
        (result.issues.length ? result.issues.join('; ') : 'Gemini marked address as suspicious'),
    };
  }

  return {
    validationStatus: AddressValidationStatus.VALID,
    validationReason: result.validationReason ?? null,
  };
}

export class AddressIntelligenceService {
  constructor(private geoProvider: GeocodingProvider = geocodingProvider) {}

  async normalizeAddress(input: {
    addressRaw?: string | null;
    city?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    floor?: string | null;
    apartment?: string | null;
  }): Promise<NormalizedAddressResult> {
    const addressRaw = (
      input.addressRaw || [input.street, input.houseNumber, input.city].filter(Boolean).join(', ')
    ).trim();

    const base: NormalizedAddressResult = {
      addressRaw,
      city: input.city ?? null,
      street: input.street ?? null,
      houseNumber: input.houseNumber ?? null,
      floor: input.floor ?? null,
      apartment: input.apartment ?? null,
      formattedAddress: input.addressRaw ?? null,
      issues: [],
      isValid: false,
      validationStatus: AddressValidationStatus.SUSPICIOUS,
      validationReason: null,
    };

    if (!addressRaw) {
      return {
        ...base,
        validationStatus: AddressValidationStatus.MISSING,
        validationReason: 'No address provided',
      };
    }

    // AI provider removed - use rule-based validation based on available fields
    const missingCore = [input.city, input.street, input.houseNumber].filter(
      (part) => !part || `${part}`.trim() === ''
    );
    if (missingCore.length > 0) {
      return {
        ...base,
        validationStatus: AddressValidationStatus.MISSING,
        validationReason: `Missing address parts: ${missingCore.join(', ')}`,
      };
    }

    const formattedAddress = [input.street, input.houseNumber, input.city]
      .filter(Boolean)
      .join(', ');

    return {
      ...base,
      formattedAddress,
      isValid: true,
      validationStatus: AddressValidationStatus.VALID,
      validationReason: null,
    };
  }

  async normalizeOrderAddress(
    orderId: string,
    options?: { force?: boolean }
  ): Promise<NormalizedAddressResult | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        addressLine: true,
        addressRaw: true,
        city: true,
        street: true,
        houseNumber: true,
        floor: true,
        apartment: true,
        addressValidationStatus: true,
        latitude: true,
        longitude: true,
        lat: true,
        lng: true,
        shippingAddress: {
          select: {
            city: true,
            street: true,
            number: true,
            floor: true,
            apartment: true,
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    if (!options?.force && order.addressValidationStatus === AddressValidationStatus.VALID) {
      return {
        addressRaw: order.addressRaw || order.addressLine || '',
        city: order.city,
        street: order.street,
        houseNumber: order.houseNumber,
        floor: order.floor,
        apartment: order.apartment,
        formattedAddress: order.addressLine,
        issues: [],
        isValid: true,
        validationStatus: order.addressValidationStatus,
        validationReason: null,
        latitude: order.latitude ?? order.lat ?? null,
        longitude: order.longitude ?? order.lng ?? null,
      };
    }

    const shipping = order.shippingAddress;
    const normalized = await this.normalizeAddress({
      addressRaw: order.addressRaw ?? order.addressLine,
      city: order.city ?? shipping?.city,
      street: order.street ?? shipping?.street,
      houseNumber: order.houseNumber ?? shipping?.number,
      floor: order.floor ?? shipping?.floor,
      apartment: order.apartment ?? shipping?.apartment,
    });

    const geocodeResult = await this.resolveCoordinates(
      normalized,
      order.latitude ?? order.lat,
      order.longitude ?? order.lng
    );

    const update: Prisma.OrderUpdateInput = {
      addressRaw: normalized.addressRaw,
      city: normalized.city ?? order.city,
      street: normalized.street ?? order.street,
      houseNumber: normalized.houseNumber ?? order.houseNumber,
      floor: normalized.floor ?? order.floor,
      apartment: normalized.apartment ?? order.apartment,
      addressValidationStatus: normalized.validationStatus,
      addressValidationReason: normalized.validationReason,
    };

    if (geocodeResult) {
      update.latitude = geocodeResult.lat;
      update.longitude = geocodeResult.lng;
      update.lat = geocodeResult.lat;
      update.lng = geocodeResult.lng;
      normalized.latitude = geocodeResult.lat;
      normalized.longitude = geocodeResult.lng;
    }

    await prisma.order.update({ where: { id: orderId }, data: update });

    return normalized;
  }

  private async resolveCoordinates(
    normalized: NormalizedAddressResult,
    existingLat?: number | null,
    existingLng?: number | null
  ): Promise<GeocodingResult | null> {
    if (typeof existingLat === 'number' && typeof existingLng === 'number') {
      // Return existing coords in GeocodingResult shape if feasible, but we lack metadata.
      // If we want to force re-geocode to get metadata, we should handle that via options.
      // For now, return coordinates so we don't overwrite with null, but we won't have new metadata.
      return { lat: existingLat, lng: existingLng };
    }

    // External geocoders are outside the MVP: in business mode, addresses never leave the system.
    if (isTenantRuntime()) {
      return null;
    }

    if (normalized.validationStatus !== AddressValidationStatus.VALID) {
      return null;
    }

    if (!normalized.formattedAddress) {
      return null;
    }

    try {
      return await this.geoProvider.geocode(normalized.formattedAddress);
    } catch (error) {
      console.warn('Geocoding provider failed', error);
      return null;
    }
  }
}

export const addressIntelService = new AddressIntelligenceService();
