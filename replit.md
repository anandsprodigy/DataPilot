# Safety Stock Calculator

## Overview

This is a professional web-based safety stock calculation application designed for supply chain professionals. The application allows users to upload CSV files containing historical demand data, item master information, and forecast data to calculate safety stock levels using both historical variance and forecast error methods. The system provides detailed calculations, progress tracking, and downloadable results in CSV format.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

**Frontend Architecture**
- Built with React 18 and TypeScript for type safety and modern development
- Uses Vite as the build tool for fast development and optimized production builds
- Styled with Tailwind CSS and shadcn/ui components for a professional, consistent design system
- Implements wouter for lightweight client-side routing
- Uses TanStack Query for server state management and API communication
- Features drag-and-drop file upload with react-dropzone for improved user experience

**Backend Architecture**
- Express.js server with TypeScript for API endpoints and business logic
- Modular service architecture with separate CSV parser and safety stock calculator services
- RESTful API design with proper error handling and request logging
- File upload handling with multer for CSV processing
- In-memory storage implementation with interface for future database integration

**Data Processing Pipeline**
- CSV parsing service validates file structure and transforms data into typed interfaces
- Safety stock calculator implements statistical formulas including normal distribution calculations
- Supports two calculation methods: historical variance-based and forecast error-based
- Progress tracking system provides real-time updates during long-running calculations

**UI/UX Design**
- Professional three-step workflow: upload → calculation → results
- Real-time file preview with data validation feedback
- Progress tracking with visual indicators during calculations
- Responsive design optimized for desktop supply chain professionals
- Toast notifications for user feedback and error handling

**Data Storage Strategy**
- Currently uses in-memory storage for rapid development and testing
- Implements storage interface pattern for easy migration to persistent databases
- Schema designed with Drizzle ORM for future PostgreSQL integration
- Structured data types for history data, item master, and forecast information

**Safety Stock Calculation Engine**
- Implements standard safety stock formulas used in supply chain management
- Normal distribution inverse CDF calculation for service factor determination
- Support for multiple calculation methodologies (historical vs forecast-based)
- Configurable service levels and lead time variance parameters

## External Dependencies

**Core Framework Dependencies**
- React 18 with TypeScript for frontend development
- Express.js for backend API server
- Vite for build tooling and development server

**UI Component Libraries**
- Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling
- shadcn/ui for pre-built component library
- Lucide React for consistent iconography

**Data Management**
- TanStack Query for API state management and caching
- Drizzle ORM configured for PostgreSQL (schema definition only)
- Zod for runtime type validation and schema parsing

**File Processing**
- Multer for handling multipart file uploads
- CSV parsing implemented with custom service (no external CSV library)

**Development Tools**
- TypeScript for static type checking
- ESBuild for production bundling
- PostCSS with Autoprefixer for CSS processing

**Database Preparation**
- Drizzle Kit for database schema management
- PostgreSQL configuration ready (using @neondatabase/serverless)
- Environment variable setup for DATABASE_URL

**Hosting and Deployment**
- Replit-specific plugins for development environment
- Static file serving configuration for production builds
- Environment-based configuration for development vs production