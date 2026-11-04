/**
 * Advanced CRUD Operation Types for Ordex OMS
 * Type-safe data access patterns and business logic modeling
 */

import type {
  Brand,
  Result,
  DeepPartial,
  RequiredBy,
  PartialBy,
  NonNullableProps,
  Paths,
  PathType
} from './utilities';

// ==================== ENTITY CONSTRAINTS ====================

/**
 * Base entity interface that all domain entities must implement
 */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

/**
 * Soft-deletable entity
 */
export interface SoftDeletableEntity extends BaseEntity {
  readonly deletedAt?: Date | string | null;
  readonly isDeleted?: boolean;
}

/**
 * Auditable entity with user tracking
 */
export interface AuditableEntity extends BaseEntity {
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

/**
 * Versionable entity for optimistic locking
 */
export interface VersionableEntity extends BaseEntity {
  readonly version: number;
}

// ==================== CRUD OPERATION TYPES ====================

/**
 * Generic create input - excludes system-generated fields
 */
export type CreateInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'version'
> & {
  // Allow optional override of ID for specific use cases
  readonly id?: string;
};

/**
 * Generic update input - makes most fields optional except ID
 */
export type UpdateInput<T extends BaseEntity> = RequiredBy<
  DeepPartial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>,
  'id'
> & {
  // Include version for optimistic locking
  readonly version?: number;
};

/**
 * Patch input - allows partial updates with path-specific changes
 */
export type PatchInput<T extends BaseEntity> = {
  readonly id: string;
  readonly patches: ReadonlyArray<{
    readonly op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    readonly path: Paths<T>;
    readonly value?: PathType<T, Paths<T>>;
    readonly from?: Paths<T>; // for move/copy operations
  }>;
  readonly version?: number;
};

/**
 * Upsert input - create or update based on existence
 */
export type UpsertInput<T extends BaseEntity> = 
  | ({ readonly mode: 'create' } & CreateInput<T>)
  | ({ readonly mode: 'update' } & UpdateInput<T>);

/**
 * Bulk operation input
 */
export type BulkOperationInput<T extends BaseEntity> = {
  readonly operations: ReadonlyArray<
    | ({ readonly type: 'create' } & CreateInput<T>)
    | ({ readonly type: 'update' } & UpdateInput<T>)
    | ({ readonly type: 'delete'; readonly id: string; readonly version?: number })
  >;
  readonly transactional?: boolean;
  readonly continueOnError?: boolean;
};

// ==================== QUERY TYPES ====================

/**
 * Field selector for projection queries
 */
export type FieldSelector<T> = {
  readonly [K in keyof T]?: boolean | (T[K] extends object ? FieldSelector<T[K]> : boolean);
};

/**
 * Sort specification
 */
export type SortSpec<T extends BaseEntity> = {
  readonly field: keyof T;
  readonly direction: 'asc' | 'desc';
  readonly nullsLast?: boolean;
};

/**
 * Filter operators for type-safe querying
 */
export type FilterOperators<T> = T extends string
  ? {
      readonly $eq?: T;
      readonly $ne?: T;
      readonly $in?: readonly T[];
      readonly $nin?: readonly T[];
      readonly $like?: string;
      readonly $ilike?: string; // case insensitive
      readonly $regex?: RegExp;
      readonly $startsWith?: string;
      readonly $endsWith?: string;
      readonly $contains?: string;
    }
  : T extends number
  ? {
      readonly $eq?: T;
      readonly $ne?: T;
      readonly $gt?: T;
      readonly $gte?: T;
      readonly $lt?: T;
      readonly $lte?: T;
      readonly $in?: readonly T[];
      readonly $nin?: readonly T[];
      readonly $between?: readonly [T, T];
    }
  : T extends Date
  ? {
      readonly $eq?: T;
      readonly $ne?: T;
      readonly $gt?: T;
      readonly $gte?: T;
      readonly $lt?: T;
      readonly $lte?: T;
      readonly $between?: readonly [T, T];
    }
  : T extends boolean
  ? {
      readonly $eq?: T;
      readonly $ne?: T;
    }
  : T extends Array<infer U>
  ? {
      readonly $size?: number;
      readonly $elemMatch?: FilterOperators<U>;
      readonly $all?: readonly U[];
      readonly $in?: readonly U[];
      readonly $nin?: readonly U[];
    }
  : T extends object
  ? {
      readonly $exists?: boolean;
      readonly $type?: string;
    } & {
      readonly [K in keyof T]?: FilterOperators<T[K]>;
    }
  : {
      readonly $eq?: T;
      readonly $ne?: T;
      readonly $exists?: boolean;
    };

/**
 * Where clause type for complex queries
 */
export type WhereClause<T extends BaseEntity> = {
  readonly [K in keyof T]?: FilterOperators<T[K]>;
} & {
  readonly $and?: ReadonlyArray<WhereClause<T>>;
  readonly $or?: ReadonlyArray<WhereClause<T>>;
  readonly $not?: WhereClause<T>;
};

/**
 * Join specification for relational queries
 */
export type JoinSpec<T extends BaseEntity, TJoin extends BaseEntity> = {
  readonly type: 'inner' | 'left' | 'right' | 'full';
  readonly entity: string; // Entity name to join
  readonly on: {
    readonly local: keyof T;
    readonly foreign: keyof TJoin;
  };
  readonly select?: FieldSelector<TJoin>;
  readonly where?: WhereClause<TJoin>;
};

/**
 * Complete query specification
 */
export interface QuerySpec<T extends BaseEntity> {
  readonly where?: WhereClause<T>;
  readonly select?: FieldSelector<T>;
  readonly orderBy?: ReadonlyArray<SortSpec<T>>;
  readonly limit?: number;
  readonly offset?: number;
  readonly joins?: ReadonlyArray<JoinSpec<T, any>>;
  readonly groupBy?: ReadonlyArray<keyof T>;
  readonly having?: WhereClause<T>;
}

/**
 * Paginated query parameters
 */
export interface PaginatedQuery<T extends BaseEntity> extends QuerySpec<T> {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Cursor-based pagination query
 */
export interface CursorQuery<T extends BaseEntity> extends QuerySpec<T> {
  readonly cursor?: string;
  readonly limit: number;
  readonly cursorField?: keyof T;
}

// ==================== RESULT TYPES ====================

/**
 * Query result with metadata
 */
export interface QueryResult<T extends BaseEntity> {
  readonly items: readonly T[];
  readonly total?: number;
  readonly hasMore?: boolean;
  readonly cursor?: string;
  readonly executionTime?: number;
}

/**
 * Single entity result
 */
export type EntityResult<T extends BaseEntity> = Result<T | null, Error>;

/**
 * Multiple entities result
 */
export type EntitiesResult<T extends BaseEntity> = Result<QueryResult<T>, Error>;

/**
 * Mutation result with affected count
 */
export interface MutationResult<T extends BaseEntity = BaseEntity> {
  readonly affected: number;
  readonly entities?: readonly T[];
  readonly errors?: ReadonlyArray<{
    readonly index?: number;
    readonly error: string;
    readonly code?: string;
  }>;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult<T extends BaseEntity> {
  readonly created: readonly T[];
  readonly updated: readonly T[];
  readonly deleted: readonly string[]; // IDs
  readonly errors: ReadonlyArray<{
    readonly operation: 'create' | 'update' | 'delete';
    readonly index: number;
    readonly error: string;
    readonly data?: any;
  }>;
  readonly totalProcessed: number;
  readonly totalErrors: number;
}

// ==================== REPOSITORY INTERFACE ====================

/**
 * Generic repository interface for CRUD operations
 */
export interface Repository<T extends BaseEntity> {
  // Basic CRUD
  readonly create: (input: CreateInput<T>) => Promise<Result<T, Error>>;
  readonly findById: (id: string) => Promise<EntityResult<T>>;
  readonly update: (input: UpdateInput<T>) => Promise<Result<T, Error>>;
  readonly delete: (id: string, version?: number) => Promise<Result<boolean, Error>>;
  
  // Advanced queries
  readonly findOne: (query: QuerySpec<T>) => Promise<EntityResult<T>>;
  readonly findMany: (query: QuerySpec<T>) => Promise<EntitiesResult<T>>;
  readonly findPaginated: (query: PaginatedQuery<T>) => Promise<EntitiesResult<T>>;
  readonly findCursor: (query: CursorQuery<T>) => Promise<EntitiesResult<T>>;
  
  // Bulk operations
  readonly bulkCreate: (inputs: readonly CreateInput<T>[]) => Promise<Result<readonly T[], Error>>;
  readonly bulkUpdate: (inputs: readonly UpdateInput<T>[]) => Promise<Result<readonly T[], Error>>;
  readonly bulkDelete: (ids: readonly string[]) => Promise<Result<MutationResult, Error>>;
  readonly bulkOperation: (input: BulkOperationInput<T>) => Promise<Result<BulkOperationResult<T>, Error>>;
  
  // Aggregation
  readonly count: (where?: WhereClause<T>) => Promise<Result<number, Error>>;
  readonly exists: (where: WhereClause<T>) => Promise<Result<boolean, Error>>;
  readonly aggregate: <TAgg>(spec: AggregationSpec<T, TAgg>) => Promise<Result<TAgg, Error>>;
}

/**
 * Aggregation specification
 */
export interface AggregationSpec<T extends BaseEntity, TAgg> {
  readonly pipeline: ReadonlyArray<{
    readonly $match?: WhereClause<T>;
    readonly $group?: {
      readonly _id: keyof T | null;
      readonly [key: string]: {
        readonly $sum?: keyof T | number;
        readonly $avg?: keyof T;
        readonly $min?: keyof T;
        readonly $max?: keyof T;
        readonly $count?: boolean;
        readonly $first?: keyof T;
        readonly $last?: keyof T;
      };
    };
    readonly $sort?: Record<string, 1 | -1>;
    readonly $limit?: number;
    readonly $skip?: number;
    readonly $project?: Record<string, 1 | 0>;
  }>;
}

// ==================== BUSINESS LOGIC TYPES ====================

/**
 * Domain service interface for business operations
 */
export interface DomainService<T extends BaseEntity> {
  readonly repository: Repository<T>;
  
  // Business operations
  readonly validateCreate: (input: CreateInput<T>) => Promise<Result<CreateInput<T>, ValidationError[]>>;
  readonly validateUpdate: (input: UpdateInput<T>) => Promise<Result<UpdateInput<T>, ValidationError[]>>;
  readonly beforeCreate: (input: CreateInput<T>) => Promise<Result<CreateInput<T>, Error>>;
  readonly afterCreate: (entity: T) => Promise<Result<void, Error>>;
  readonly beforeUpdate: (input: UpdateInput<T>, existing: T) => Promise<Result<UpdateInput<T>, Error>>;
  readonly afterUpdate: (entity: T, previous: T) => Promise<Result<void, Error>>;
  readonly beforeDelete: (entity: T) => Promise<Result<void, Error>>;
  readonly afterDelete: (entity: T) => Promise<Result<void, Error>>;
}

/**
 * Validation error type
 */
export interface ValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly value?: unknown;
}

/**
 * Business rule interface
 */
export interface BusinessRule<T extends BaseEntity> {
  readonly name: string;
  readonly description: string;
  readonly validate: (entity: T, context?: unknown) => Promise<Result<void, ValidationError>>;
}

/**
 * Workflow step for complex business processes
 */
export interface WorkflowStep<T extends BaseEntity, TContext = unknown> {
  readonly name: string;
  readonly condition?: (entity: T, context: TContext) => Promise<boolean>;
  readonly execute: (entity: T, context: TContext) => Promise<Result<T, Error>>;
  readonly rollback?: (entity: T, context: TContext) => Promise<Result<void, Error>>;
}

/**
 * Complete workflow definition
 */
export interface Workflow<T extends BaseEntity, TContext = unknown> {
  readonly name: string;
  readonly steps: ReadonlyArray<WorkflowStep<T, TContext>>;
  readonly execute: (entity: T, context: TContext) => Promise<Result<T, Error>>;
}

// ==================== TRANSACTION TYPES ====================

/**
 * Transaction context for database operations
 */
export interface TransactionContext {
  readonly id: string;
  readonly isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  readonly readonly?: boolean;
}

/**
 * Transactional repository that supports transactions
 */
export interface TransactionalRepository<T extends BaseEntity> extends Repository<T> {
  readonly withTransaction: <TResult>(
    callback: (repo: Repository<T>, ctx: TransactionContext) => Promise<Result<TResult, Error>>
  ) => Promise<Result<TResult, Error>>;
}

// ==================== EVENT SOURCING TYPES ====================

/**
 * Domain event for event sourcing
 */
export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly payload: TPayload;
  readonly version: number;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event store interface
 */
export interface EventStore {
  readonly append: <T>(
    aggregateId: string,
    events: ReadonlyArray<DomainEvent<T>>,
    expectedVersion?: number
  ) => Promise<Result<void, Error>>;
  
  readonly getEvents: (
    aggregateId: string,
    fromVersion?: number
  ) => Promise<Result<ReadonlyArray<DomainEvent>, Error>>;
  
  readonly getAllEvents: (
    fromPosition?: string,
    maxEvents?: number
  ) => Promise<Result<ReadonlyArray<DomainEvent>, Error>>;
}

/**
 * Event sourced aggregate root
 */
export interface AggregateRoot<T extends BaseEntity> {
  readonly id: string;
  readonly version: number;
  readonly uncommittedEvents: ReadonlyArray<DomainEvent>;
  readonly markEventsAsCommitted: () => void;
  readonly loadFromHistory: (events: ReadonlyArray<DomainEvent>) => void;
  readonly getSnapshot: () => T;
}