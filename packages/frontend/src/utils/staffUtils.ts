export interface UserType {
  type: 'staff' | 'service_account' | 'equipment';
  category?: string;
  displayName?: string;
}

/**
 * Check if a string looks like a UUID.
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Categorizes a non-staff identifier. Since Azure AD couldn't find it, it's a non-AD account.
 * This function assumes the identifier is confirmed as non-staff via an API check.
 */
export function categorizeNonStaff(identifier: string): UserType {
  // Simple rule: if Azure AD can't find it, it's a non-AD account
  return { type: 'service_account', category: 'Non-AD Account', displayName: identifier };
}

/**
 * Get a user-friendly category name for display.
 */
export function getUserCategoryDisplay(userType: UserType): string {
  switch (userType.type) {
    case 'staff':
      return 'Staff Member';
    case 'equipment':
      return userType.category || 'Equipment';
    case 'service_account':
      return userType.category || 'Service Account';
    default:
      return 'Unknown';
  }
}

/**
 * Get appropriate icon for user type.
 */
export function getUserTypeIcon(userType: UserType): string {
  switch (userType.type) {
    case 'staff':
      return 'User';
    case 'equipment':
      if (userType.category === 'Mobile Device') return 'Tablet';
      if (userType.category === 'AR/VR Device') return 'Glasses';
      return 'Monitor';
    case 'service_account':
      return 'Settings';
    default:
      return 'HelpCircle';
  }
} 