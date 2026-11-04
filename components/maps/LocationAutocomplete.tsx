'use client';

import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';

export interface PlaceResult {
  formatted_address: string;
  place_id: string;
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
}

interface LocationAutocompleteProps {
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

function toPlaceResult(parsed: {
  formattedAddress: string;
  placeId: string;
  lat: number;
  lng: number;
}): PlaceResult {
  return {
    formatted_address: parsed.formattedAddress,
    place_id: parsed.placeId,
    geometry: {
      location: {
        lat: () => parsed.lat,
        lng: () => parsed.lng,
      },
    },
  };
}

export default function LocationAutocomplete({
  onPlaceSelected,
  placeholder,
  className,
}: LocationAutocompleteProps) {
  return (
    <PlacesAutocomplete
      className={className}
      placeholder={placeholder}
      onAddressSelect={(address) => onPlaceSelected(toPlaceResult(address))}
    />
  );
}
