// Global type declarations for the application

// Extend the Window interface to include Google Maps API
declare global {
  interface Window {
    google: any;
    orderSelectCallback?: (orderId: string) => void;
  }
}

// Ensure this file is treated as a module
export {};
