// These libraries don't publish their own TypeScript declarations.
// Declaring them as `any`-typed modules silences "Could not find a declaration file"
// errors without needing @types packages that don't exist for them.
declare module 'cornerstone-core';
declare module 'cornerstone-wado-image-loader';
declare module 'dicom-parser';