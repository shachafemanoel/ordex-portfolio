export class AuthenticationError extends Error {
  statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class SessionExpiredError extends AuthenticationError {
  constructor(message: string = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
