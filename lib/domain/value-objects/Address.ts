/**
 * Address Value Object
 *
 * Represents a physical address with optional geocoding
 *
 * @module lib/domain/value-objects/Address
 */

/**
 * Address type
 */
export enum AddressType {
  BILLING = 'BILLING',
  SHIPPING = 'SHIPPING',
}

/**
 * Coordinates for geocoded addresses
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Address Value Object
 */
export class Address {
  private constructor(
    private readonly _id: string,
    private readonly _type: AddressType,
    private readonly _city: string,
    private readonly _street: string,
    private readonly _number: string,
    private readonly _floor: string | null,
    private readonly _notes: string | null,
    private readonly _coordinates: Coordinates | null
  ) {
    this.validate();
  }

  /**
   * Create Address
   */
  static create(params: {
    id: string;
    type: AddressType;
    city: string;
    street: string;
    number: string;
    floor?: string | null;
    notes?: string | null;
    coordinates?: Coordinates | null;
  }): Address {
    return new Address(
      params.id,
      params.type,
      params.city,
      params.street,
      params.number,
      params.floor ?? null,
      params.notes ?? null,
      params.coordinates ?? null
    );
  }

  /**
   * Validate address
   */
  private validate(): void {
    if (!this._city?.trim()) {
      throw new Error('City is required');
    }

    if (!this._street?.trim()) {
      throw new Error('Street is required');
    }

    if (!this._number?.trim()) {
      throw new Error('Number is required');
    }

    if (this._coordinates) {
      const { latitude, longitude } = this._coordinates;

      if (latitude < -90 || latitude > 90) {
        throw new Error('Invalid latitude');
      }

      if (longitude < -180 || longitude > 180) {
        throw new Error('Invalid longitude');
      }
    }
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get type(): AddressType {
    return this._type;
  }

  get city(): string {
    return this._city;
  }

  get street(): string {
    return this._street;
  }

  get number(): string {
    return this._number;
  }

  get floor(): string | null {
    return this._floor;
  }

  get notes(): string | null {
    return this._notes;
  }

  get coordinates(): Coordinates | null {
    return this._coordinates;
  }

  /**
   * Check if address has geocoded coordinates
   */
  hasCoordinates(): boolean {
    return this._coordinates !== null;
  }

  /**
   * Get formatted address line
   */
  getFormattedAddress(): string {
    const parts = [this._street, this._number];

    if (this._floor) {
      parts.push(`Floor ${this._floor}`);
    }

    parts.push(this._city);

    return parts.join(', ');
  }

  /**
   * Get short address (street and number only)
   */
  getShortAddress(): string {
    return `${this._street} ${this._number}, ${this._city}`;
  }

  /**
   * Create a copy with updated coordinates
   */
  withCoordinates(coordinates: Coordinates): Address {
    return new Address(
      this._id,
      this._type,
      this._city,
      this._street,
      this._number,
      this._floor,
      this._notes,
      coordinates
    );
  }

  /**
   * Create a copy with updated notes
   */
  withNotes(notes: string): Address {
    return new Address(
      this._id,
      this._type,
      this._city,
      this._street,
      this._number,
      this._floor,
      notes,
      this._coordinates
    );
  }

  /**
   * Check equality
   */
  equals(other: Address): boolean {
    return (
      this._city === other._city &&
      this._street === other._street &&
      this._number === other._number &&
      this._floor === other._floor
    );
  }

  /**
   * Check if same location (ignoring type and notes)
   */
  isSameLocation(other: Address): boolean {
    return this.equals(other);
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this._id,
      type: this._type,
      city: this._city,
      street: this._street,
      number: this._number,
      floor: this._floor,
      notes: this._notes,
      coordinates: this._coordinates,
    };
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.getFormattedAddress();
  }
}
