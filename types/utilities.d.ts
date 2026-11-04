/**
 * Advanced TypeScript Utility Types for Ordex OMS
 * Enterprise-grade type utilities for complex business logic modeling
 */

// ==================== BRAND TYPES ====================

declare const __brand: unique symbol;

/**
 * Creates branded types for compile-time type safety
 * @example Brand<string, 'OrderId'> // OrderId cannot be assigned to regular string
 */
export type Brand<T, TBrand extends string> = T & {
  readonly [__brand]: TBrand;
};

// Branded primitive types
export type OrderId = Brand<string, 'OrderId'>;
export type UserId = Brand<string, 'UserId'>;
export type SupplierId = Brand<string, 'SupplierId'>;
export type SkuId = Brand<string, 'SkuId'>;
export type ClientId = Brand<string, 'ClientId'>;
export type PurchaseOrderId = Brand<string, 'PurchaseOrderId'>;
export type CalendarEventId = Brand<string, 'CalendarEventId'>;
export type NotificationId = Brand<string, 'NotificationId'>;

// Branded numeric types
export type OrderNumber = Brand<number, 'OrderNumber'>;
export type Quantity = Brand<number, 'Quantity'>;
export type Price = Brand<number, 'Price'>;
export type Percentage = Brand<number, 'Percentage'>;

// Branded temporal types
export type Timestamp = Brand<Date, 'Timestamp'>;
export type ISO8601 = Brand<string, 'ISO8601'>;

// ==================== CONDITIONAL TYPES ====================

/**
 * Extract keys from T that have values of type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Make specific properties optional while keeping others required
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required while keeping others optional
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Exclude null and undefined from all properties
 */
export type NonNullableProps<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

/**
 * Make all properties nullable
 */
export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// ==================== MAPPED TYPES ====================

/**
 * Create a type with keys from K and values of type T
 */
export type Record<K extends keyof any, T> = {
  [P in K]: T;
};

/**
 * Create a mapper from source type to target type
 */
export type Mapper<TSource, TTarget> = (source: TSource) => TTarget;

/**
 * Create a validator function type
 */
export type Validator<T> = (value: unknown) => value is T;

/**
 * Create a transformer function type
 */
export type Transformer<TInput, TOutput> = (input: TInput) => TOutput;

// ==================== FUNCTION TYPES ====================

/**
 * Extract parameters from a function type
 */
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

/**
 * Extract return type from a function
 */
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;

/**
 * Create an async version of a function type
 */
export type Async<T extends (...args: any[]) => any> = T extends (...args: infer P) => infer R 
  ? (...args: P) => Promise<R>
  : never;

// ==================== ARRAY AND TUPLE TYPES ====================

/**
 * Get the length of a tuple type
 */
export type Length<T extends readonly any[]> = T['length'];

/**
 * Get the first element of a tuple
 */
export type Head<T extends readonly any[]> = T extends readonly [infer H, ...any[]] ? H : never;

/**
 * Get all elements except the first
 */
export type Tail<T extends readonly any[]> = T extends readonly [any, ...infer R] ? R : never;

/**
 * Get the last element of a tuple
 */
export type Last<T extends readonly any[]> = T extends readonly [...any[], infer L] ? L : never;

/**
 * Non-empty array type
 */
export type NonEmptyArray<T> = [T, ...T[]];

// ==================== OBJECT MANIPULATION TYPES ====================

/**
 * Get all possible paths through an object type as string literals
 */
export type Paths<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? K | `${K}.${Paths<T[K]>}`
    : K
  : never;

/**
 * Get the type of a nested property by path
 */
export type PathType<T, P extends Paths<T>> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? R extends Paths<T[K]>
      ? PathType<T[K], R>
      : never
    : never
  : never;

/**
 * Create a flattened version of nested object keys
 */
export type FlattenKeys<T extends Record<string, any>, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? FlattenKeys<T[K], `${Prefix}${string & K}.`>
    : `${Prefix}${string & K}`;
}[keyof T];

// ==================== UNION AND INTERSECTION TYPES ====================

/**
 * Create a discriminated union with a discriminator property
 */
export type DiscriminatedUnion<T extends Record<string, any>, K extends keyof T> = T extends any
  ? T & { readonly __type: T[K] }
  : never;

/**
 * Extract union member by discriminator value
 */
export type UnionByDiscriminator<T extends { __type: any }, D extends T['__type']> = T extends { __type: D }
  ? T
  : never;

/**
 * Get all possible values of a discriminator
 */
export type DiscriminatorValues<T extends { __type: any }> = T['__type'];

/**
 * Distribute a type over a union
 */
export type Distribute<T> = T extends any ? { value: T } : never;

// ==================== TEMPLATE LITERAL TYPES ====================

/**
 * Capitalize first letter of string literal
 */
export type Capitalize<S extends string> = S extends `${infer F}${infer R}` 
  ? `${Uppercase<F>}${R}` 
  : S;

/**
 * Convert string to camelCase
 */
export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<CamelCase<`${P2}${P3}`>>}`
  : S;

/**
 * Convert camelCase to snake_case
 */
export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${SnakeCase<U>}`
  : S;

/**
 * Create kebab-case from string
 */
export type KebabCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '-' : ''}${Lowercase<T>}${KebabCase<U>}`
  : S;

// ==================== ADVANCED PATTERN MATCHING ====================

/**
 * Pattern matching for discriminated unions
 */
export type Match<T, Pattern extends Partial<Record<keyof T, any>>> = T extends Pattern ? T : never;

/**
 * Type-safe switch/case alternative
 */
export type Switch<T extends string | number, Cases extends Record<string | number, any>, Default = never> = 
  T extends keyof Cases ? Cases[T] : Default;

/**
 * Conditional type for exhaustive checking
 */
export type ExhaustiveCheck<T extends never> = T;

// ==================== HIGHER-ORDER TYPES ====================

/**
 * Create a type constructor that takes a type parameter
 */
export type TypeConstructor<F extends <T>(...args: any[]) => any> = F;

/**
 * Apply a type function to a type
 */
export type Apply<F extends TypeConstructor<any>, T> = F extends TypeConstructor<infer G>
  ? G<T>
  : never;

/**
 * Compose two type functions
 */
export type Compose<F extends TypeConstructor<any>, G extends TypeConstructor<any>> = 
  <T>(...args: any[]) => Apply<F, Apply<G, T>>;

// ==================== ERROR HANDLING TYPES ====================

/**
 * Result type for error handling without exceptions
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Optional type that can represent absence of value
 */
export type Option<T> = T | null | undefined;

/**
 * Extract success type from Result
 */
export type SuccessType<T> = T extends Result<infer S, any> ? S : never;

/**
 * Extract error type from Result
 */
export type ErrorType<T> = T extends Result<any, infer E> ? E : never;

// ==================== METADATA TYPES ====================

/**
 * Add metadata to a type
 */
export type WithMeta<T, M extends Record<string, any>> = T & {
  readonly __meta: M;
};

/**
 * Extract metadata from a type
 */
export type MetaOf<T> = T extends WithMeta<any, infer M> ? M : never;

/**
 * Strip metadata from a type
 */
export type StripMeta<T> = T extends WithMeta<infer U, any> ? U : T;