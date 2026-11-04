/**
 * Dependency Injection Module
 *
 * Exports DI container and bootstrap functions
 *
 * @module lib/di
 */

export { Container, ServiceLifetime, globalContainer, createContainer } from '@/lib/di/Container';
export {
  bootstrapContainer,
  createBootstrappedContainer,
  getContainer,
  resetContainer,
} from './bootstrap';
