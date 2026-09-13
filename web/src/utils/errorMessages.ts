// Maps technical errors to user-friendly messages
// Falls back to a generic message if no match found

const ERROR_MAP: Record<string, string> = {
  // Network errors
  'Failed to fetch': 'Unable to connect to the server. Please check your internet connection and try again.',
  'Network Error': 'Unable to connect to the server. Please check your internet connection and try again.',
  'NetworkError': 'Unable to connect to the server. Please check your internet connection and try again.',
  'ERR_NETWORK': 'Unable to connect to the server. Please check your internet connection and try again.',
  'ERR_CONNECTION_REFUSED': 'The server is currently unavailable. Please try again in a few moments.',
  'ECONNREFUSED': 'The server is currently unavailable. Please try again in a few moments.',
  'ETIMEDOUT': 'The request timed out. Please try again.',
  'timeout': 'The request timed out. Please try again.',

  // Auth errors
  'Unauthorized': 'Your session has expired. Please sign in again.',
  '401': 'Your session has expired. Please sign in again.',
  'Invalid token': 'Your session has expired. Please sign in again.',
  'Token expired': 'Your session has expired. Please sign in again.',
  'jwt expired': 'Your session has expired. Please sign in again.',
  'Forbidden': 'You don\'t have permission to perform this action.',
  '403': 'You don\'t have permission to perform this action.',

  // Server errors
  '500': 'Something went wrong on our end. Please try again.',
  '502': 'The server is temporarily unavailable. Please try again in a few moments.',
  '503': 'The service is temporarily unavailable. Please try again in a few moments.',
  '504': 'The server took too long to respond. Please try again.',
  'Internal Server Error': 'Something went wrong on our end. Please try again.',

  // Recording errors
  'NotAllowedError': 'Microphone access was denied. Please allow microphone access in your browser settings.',
  'NotFoundError': 'No microphone found. Please connect a microphone and try again.',
  'NotReadableError': 'Could not access the microphone. It may be in use by another application.',
  'OverconstrainedError': 'Could not find a suitable microphone. Please try a different device.',
  'AbortError': 'The recording was interrupted. Please try again.',

  // Upload errors
  'Upload failed': 'Failed to upload the recording. Please check your connection and try again.',
  'File too large': 'The recording is too large to upload. Please try a shorter recording.',

  // Processing errors
  'Processing failed': 'We encountered an issue processing your recording. Please try again.',
  'Transcription failed': 'We couldn\'t transcribe the recording. Please ensure audio quality and try again.',

  // Validation errors
  'Invalid NPI': 'The NPI number entered is not valid. Please check and try again.',
  'NPI not found': 'We couldn\'t find this NPI in the registry. Please verify the number.',

  // Generic database errors (hide technical details)
  'SQLITE_ERROR': 'A database error occurred. Please try again.',
  'SQLITE_CONSTRAINT': 'This record already exists or conflicts with existing data.',
  'duplicate key': 'This record already exists.',
  'unique constraint': 'This record already exists.',
  'foreign key constraint': 'This action cannot be completed due to related records.',
};

// Patterns to match (for partial matches)
const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /fetch.*failed/i, message: 'Unable to connect to the server. Please check your internet connection.' },
  { pattern: /network.*error/i, message: 'A network error occurred. Please check your connection.' },
  { pattern: /timeout/i, message: 'The request timed out. Please try again.' },
  { pattern: /unauthorized|401/i, message: 'Your session has expired. Please sign in again.' },
  { pattern: /forbidden|403/i, message: 'You don\'t have permission to perform this action.' },
  { pattern: /not found|404/i, message: 'The requested item could not be found.' },
  { pattern: /server error|500|502|503|504/i, message: 'Something went wrong on our end. Please try again.' },
  { pattern: /microphone|audio.*permission/i, message: 'Microphone access is required. Please allow access and try again.' },
  { pattern: /upload.*fail/i, message: 'Upload failed. Please check your connection and try again.' },
  { pattern: /database|sql|prisma|postgres/i, message: 'A database error occurred. Please try again.' },
  { pattern: /json.*parse|syntax.*error/i, message: 'We received an unexpected response. Please try again.' },
  { pattern: /certificate|ssl|tls/i, message: 'A security error occurred. Please try again.' },
];

export function getUserFriendlyError(error: unknown, fallback?: string): string {
  // Get the error message
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    return fallback ?? 'Something went wrong. Please try again.';
  }

  // Check exact matches first
  for (const [key, friendly] of Object.entries(ERROR_MAP)) {
    if (message.includes(key)) {
      return friendly;
    }
  }

  // Check patterns
  for (const { pattern, message: friendly } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return friendly;
    }
  }

  // If the message is already clean (no technical jargon), use it
  if (isCleanMessage(message)) {
    return message;
  }

  // Fall back to generic message
  return fallback ?? 'Something went wrong. Please try again.';
}

// Checks if a message looks user-friendly (not technical)
function isCleanMessage(message: string): boolean {
  const technicalPatterns = [
    /^[A-Z_]+Error/,           // ErrorType names like TypeError, ReferenceError
    /\b(undefined|null|NaN)\b/,
    /\b(function|object|array)\b/i,
    /\{.*\}/,                   // JSON objects
    /\[.*\]/,                   // Arrays
    /at\s+\w+\s+\(/,           // Stack traces
    /\.js:\d+/,                // File:line references
    /Error:\s/,
    /Exception:\s/,
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/,
    /\b[A-Z]{2,}_[A-Z]{2,}/,   // CONSTANT_CASE identifiers
  ];

  return !technicalPatterns.some((p) => p.test(message));
}

// For specific contexts, provide more tailored messages
export function getRecordingError(error: unknown): string {
  return getUserFriendlyError(error, 'Failed to process the recording. Please try again.');
}

export function getUploadError(error: unknown): string {
  return getUserFriendlyError(error, 'Failed to upload. Please check your connection and try again.');
}

export function getLoadError(error: unknown, what: string): string {
  return getUserFriendlyError(error, `Failed to load ${what}. Please refresh the page.`);
}

export function getSaveError(error: unknown, what: string): string {
  return getUserFriendlyError(error, `Failed to save ${what}. Please try again.`);
}
