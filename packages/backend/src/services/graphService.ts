import { Client, ResponseType } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import logger from '../utils/logger.js';

interface StaffMember {
  id: string;
  displayName: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones: string[];
}

interface LocationData {
  city: string;
  province: string;
  country: string;
}

// Province normalization mapping for Canadian provinces
const PROVINCE_NORMALIZATION: Record<string, string> = {
  // Alberta
  'AB': 'AB',
  'CA-AB': 'AB',
  'Alberta': 'AB',
  
  // British Columbia
  'BC': 'BC',
  'CA-BC': 'BC',
  'British Columbia': 'BC',
  
  // Manitoba
  'MB': 'MB',
  'CA-MB': 'MB',
  'Manitoba': 'MB',
  
  // New Brunswick
  'NB': 'NB',
  'CA-NB': 'NB',
  'New Brunswick': 'NB',
  
  // Newfoundland and Labrador
  'NL': 'NL',
  'CA-NL': 'NL',
  'Newfoundland and Labrador': 'NL',
  
  // Northwest Territories
  'NT': 'NT',
  'CA-NT': 'NT',
  'Northwest Territories': 'NT',
  
  // Nova Scotia
  'NS': 'NS',
  'CA-NS': 'NS',
  'Nova Scotia': 'NS',
  
  // Nunavut
  'NU': 'NU',
  'CA-NU': 'NU',
  'Nunavut': 'NU',
  
  // Ontario
  'ON': 'ON',
  'CA-ON': 'ON',
  'Ontario': 'ON',
  
  // Prince Edward Island
  'PE': 'PE',
  'CA-PE': 'PE',
  'Prince Edward Island': 'PE',
  
  // Quebec
  'QC': 'QC',
  'CA-QC': 'QC',
  'Quebec': 'QC',
  
  // Saskatchewan
  'SK': 'SK',
  'CA-SK': 'SK',
  'Saskatchewan': 'SK',
  
  // Yukon
  'YT': 'YT',
  'CA-YT': 'YT',
  'Yukon': 'YT',
};

function normalizeProvince(province: string, country: string): string {
  // Only normalize Canadian provinces
  if (country !== 'Canada') {
    return province;
  }
  
  return PROVINCE_NORMALIZATION[province] || province;
}

class GraphService {
  private client: Client | null = null;
  private cache = new Map<string, { data: StaffMember; expiry: number }>();
  private photoCache = new Map<string, { data: Buffer | null; expiry: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly PHOTO_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      throw new Error('Azure AD credentials not configured');
    }

    try {
      const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default'],
      });

      this.client = Client.initWithMiddleware({ authProvider });
      logger.info('Graph client initialized successfully');
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Graph client:', error);
      throw error;
    }
  }

  private isValidCacheEntry(entry: { data: StaffMember; expiry: number }): boolean {
    return Date.now() < entry.expiry;
  }

  async searchStaff(query: string, limit: number = 10): Promise<StaffMember[]> {
    try {
      const client = await this.getClient();
      
      // Use Microsoft Graph search to find users
      // Note: You may need to configure a specific group for staff members
      // For now, searching all users - in production, you'd filter by group membership
      const response = await client
        .api('/users')
        .select(['id', 'displayName', 'mail', 'jobTitle', 'department', 'officeLocation'])
        .filter(`startswith(displayName,'${query}') or startswith(mail,'${query}')`)
        .top(limit)
        .get();

      const staffMembers: StaffMember[] = response.value.map((user: any) => ({
        id: user.id,
        displayName: user.displayName || '',
        mail: user.mail,
        jobTitle: user.jobTitle,
        department: user.department,
        officeLocation: user.officeLocation,
      }));

      logger.info(`Found ${staffMembers.length} staff members for query: ${query}`);
      return staffMembers;
    } catch (error) {
      logger.error('Error searching staff:', error);
      throw new Error('Failed to search staff members');
    }
  }

  async getStaffMember(aadId: string): Promise<StaffMember | null> {
    try {
      // Check cache first
      const cached = this.cache.get(aadId);
      if (cached && this.isValidCacheEntry(cached)) {
        return cached.data;
      }

      const client = await this.getClient();
      
      const user = await client
        .api(`/users/${aadId}`)
        .select(['id', 'displayName', 'mail', 'jobTitle', 'department', 'officeLocation', 'mobilePhone', 'businessPhones'])
        .get();

      const staffMember: StaffMember = {
        id: user.id,
        displayName: user.displayName || '',
        mail: user.mail,
        jobTitle: user.jobTitle,
        department: user.department,
        officeLocation: user.officeLocation,
        mobilePhone: user.mobilePhone,
        businessPhones: user.businessPhones || [],
      };

      // Cache the result
      this.cache.set(aadId, {
        data: staffMember,
        expiry: Date.now() + this.CACHE_DURATION,
      });

      logger.info(`Retrieved staff member: ${staffMember.displayName} (${aadId})`);
      return staffMember;
    } catch (error) {
      if ((error as any)?.code === 'Request_ResourceNotFound') {
        logger.warn(`Staff member not found: ${aadId}`);
        return null;
      }
      logger.error('Error getting staff member:', error);
      throw new Error('Failed to get staff member');
    }
  }

  async getStaffFromGroup(groupId: string, limit: number = 100): Promise<StaffMember[]> {
    try {
      const client = await this.getClient();
      
      const response = await client
        .api(`/groups/${groupId}/members`)
        .select(['id', 'displayName', 'mail', 'jobTitle', 'department', 'officeLocation'])
        .top(limit)
        .get();

      const staffMembers: StaffMember[] = response.value
        .filter((member: any) => member['@odata.type'] === '#microsoft.graph.user')
        .map((user: any) => ({
          id: user.id,
          displayName: user.displayName || '',
          mail: user.mail,
          jobTitle: user.jobTitle,
          department: user.department,
          officeLocation: user.officeLocation,
        }));

      logger.info(`Retrieved ${staffMembers.length} staff members from group: ${groupId}`);
      return staffMembers;
    } catch (error) {
      logger.error('Error getting staff from group:', error);
      throw new Error('Failed to get staff from group');
    }
  }

  async findUsersBySamAccount(usernames: string[]): Promise<Record<string, { id: string; displayName: string; officeLocation?: string } | null>> {
    const result: Record<string, { id: string; displayName: string; officeLocation?: string } | null> = {};
    if (!usernames.length) return result;

    const client = await this.getClient();

    await Promise.all(
      usernames.map(async (rawUname) => {
        const uname = (rawUname || '').trim();
        if (!uname) {
          return;
        }

        try {
          // DEBUG: Log the username being resolved
          logger.info(`Resolving username: "${uname}"`);

          // Corporate domain exact match (highest priority)
          const corporateDomains = (process.env.CORP_EMAIL_DOMAINS || 'bgcengineering.ca').split(',');
          for (const domain of corporateDomains) {
            const corporateEmail = `${uname}@${domain.trim()}`;
            try {
              const corporateUsers = await client.api('/users')
                .filter(`userPrincipalName eq '${corporateEmail}' or mail eq '${corporateEmail}'`)
                .select('id,displayName,userPrincipalName,mail,officeLocation')
                .get();

              if (corporateUsers.value?.length > 0) {
                const user = corporateUsers.value[0];
                const userResult = {
                  id: user.id,
                  displayName: user.displayName,
                  officeLocation: user.officeLocation
                };
                
                // Store result for both original and trimmed keys
                result[rawUname] = userResult;
                if (rawUname !== uname) {
                  result[uname] = userResult;
                }
                
                logger.info(`✅ Resolved "${uname}" to corporate user: ${user.displayName} (${user.id})`);
                return;
              }
            } catch (error) {
              logger.warn(`Corporate domain lookup failed for ${corporateEmail}:`, error);
            }
          }

          // Exact onPremisesSamAccountName match
          try {
            const samUsers = await client.api('/users')
              .filter(`onPremisesSamAccountName eq '${uname}'`)
              .select('id,displayName,userPrincipalName,mail,officeLocation')
              .get();

            if (samUsers.value?.length > 0) {
              const user = samUsers.value[0];
              const userResult = {
                id: user.id,
                displayName: user.displayName,
                officeLocation: user.officeLocation
              };
              
              // Store result for both original and trimmed keys
              result[rawUname] = userResult;
              if (rawUname !== uname) {
                result[uname] = userResult;
              }
              
              logger.info(`✅ Resolved "${uname}" via SAM account: ${user.displayName} (${user.id})`);
              return;
            }
          } catch (error) {
            logger.warn(`SAM account lookup failed for ${uname}:`, error);
          }

          // Fuzzy startswith match (fallback)
          try {
            const filter = `startswith(userPrincipalName,'${uname}')`;
            const fuzzyUsers = await client.api('/users')
              .filter(filter)
              .select('id,displayName,userPrincipalName,mail,officeLocation')
              .top(10)
              .get();

            if (fuzzyUsers.value?.length > 0) {
              // Prefer corporate domain users
              const corporateDomains = (process.env.CORP_EMAIL_DOMAINS || 'bgcengineering.ca').split(',');
              const corporateUser = fuzzyUsers.value.find((user: any) => 
                corporateDomains.some(domain => 
                  user.userPrincipalName?.includes(`@${domain.trim()}`) || 
                  user.mail?.includes(`@${domain.trim()}`)
                )
              );

              const selectedUser = corporateUser || fuzzyUsers.value[0];
              const userResult = {
                id: selectedUser.id,
                displayName: selectedUser.displayName,
                officeLocation: selectedUser.officeLocation
              };
              
              // Store result for both original and trimmed keys
              result[rawUname] = userResult;
              if (rawUname !== uname) {
                result[uname] = userResult;
              }
              
              logger.info(`✅ Resolved "${uname}" via fuzzy match: ${selectedUser.displayName} (${selectedUser.id})`);
              return;
            }
          } catch (error) {
            logger.warn(`Fuzzy lookup failed for ${uname}:`, error);
          }

          // No match found - store null for both keys
          result[rawUname] = null;
          if (rawUname !== uname) {
            result[uname] = null;
          }
          logger.warn(`❌ Could not resolve username: "${uname}"`);

        } catch (error) {
          logger.error(`Error resolving username "${uname}":`, error);
          result[rawUname] = null;
          if (rawUname !== uname) {
            result[uname] = null;
          }
        }
      })
    );

    // DEBUG: Log the final resolution results
    const resolved = Object.entries(result).filter(([_, user]) => user !== null).length;
    const total = usernames.length;
    logger.info(`User resolution complete: ${resolved}/${total} users resolved`);

    return result;
  }

  async findUsersByDisplayName(displayNames: string[]): Promise<Record<string, { id: string; displayName: string; officeLocation?: string } | null>> {
    const result: Record<string, { id: string; displayName: string; officeLocation?: string } | null> = {};
    if (!displayNames.length) return result;

    const client = await this.getClient();

    await Promise.all(
      displayNames.map(async (rawName) => {
        const name = (rawName || '').trim();
        if (!name) {
          return;
        }

        try {
          // DEBUG: Log the display name being resolved
          logger.info(`Resolving display name: "${name}"`);

          // Exact display name match
          try {
            const exactUsers = await client.api('/users')
              .filter(`displayName eq '${name}'`)
              .select('id,displayName,userPrincipalName,mail,officeLocation')
              .get();

            if (exactUsers.value?.length > 0) {
              // If multiple users with same display name, prioritize corporate accounts
              const corporateDomains = (process.env.CORP_EMAIL_DOMAINS || 'bgcengineering.ca,cambioearth.com').split(',');
              
              let selectedUser = exactUsers.value[0]; // fallback
              
              if (exactUsers.value.length > 1) {
                // Look for corporate account first
                const corporateUser = exactUsers.value.find((user: any) => 
                  corporateDomains.some(domain => 
                    user.userPrincipalName?.toLowerCase().includes(`@${domain.trim().toLowerCase()}`) || 
                    user.mail?.toLowerCase().includes(`@${domain.trim().toLowerCase()}`)
                  )
                );
                
                if (corporateUser) {
                  selectedUser = corporateUser;
                  logger.info(`👔 Prioritized corporate account for "${name}": ${corporateUser.userPrincipalName || corporateUser.mail}`);
                } else {
                  logger.warn(`⚠️ Multiple users found for "${name}" but no corporate account detected. Using first result.`);
                }
              }
              
              const userResult = {
                id: selectedUser.id,
                displayName: selectedUser.displayName,
                officeLocation: selectedUser.officeLocation
              };
              
              // Store result for both original and trimmed keys
              result[rawName] = userResult;
              if (rawName !== name) {
                result[name] = userResult;
              }
              
              logger.info(`✅ Resolved "${name}" via exact display name: ${selectedUser.displayName} (${selectedUser.id})`);
              return;
            }
          } catch (error) {
            logger.warn(`Exact display name lookup failed for ${name}:`, error);
          }

          // Fuzzy display name match (startswith)
          try {
            const fuzzyUsers = await client.api('/users')
              .filter(`startswith(displayName,'${name}')`)
              .select('id,displayName,userPrincipalName,mail,officeLocation')
              .top(10)
              .get();

            if (fuzzyUsers.value?.length > 0) {
              // Find the best match (exact match preferred, then corporate account preferred)
              const corporateDomains = (process.env.CORP_EMAIL_DOMAINS || 'bgcengineering.ca,cambioearth.com').split(',');
              
              // First, look for exact display name match
              const exactMatch = fuzzyUsers.value.find((user: any) => 
                user.displayName?.toLowerCase() === name.toLowerCase()
              );
              
              let selectedUser;
              
              if (exactMatch) {
                selectedUser = exactMatch;
                logger.info(`🎯 Found exact display name match in fuzzy results for "${name}"`);
              } else {
                // No exact match, prioritize corporate accounts
                const corporateUser = fuzzyUsers.value.find((user: any) => 
                  corporateDomains.some(domain => 
                    user.userPrincipalName?.toLowerCase().includes(`@${domain.trim().toLowerCase()}`) || 
                    user.mail?.toLowerCase().includes(`@${domain.trim().toLowerCase()}`)
                  )
                );
                
                if (corporateUser) {
                  selectedUser = corporateUser;
                  logger.info(`👔 Prioritized corporate account in fuzzy results for "${name}": ${corporateUser.userPrincipalName || corporateUser.mail}`);
                } else {
                  selectedUser = fuzzyUsers.value[0];
                  logger.info(`📋 Using first fuzzy result for "${name}" (no corporate account found)`);
                }
              }
              
              const userResult = {
                id: selectedUser.id,
                displayName: selectedUser.displayName,
                officeLocation: selectedUser.officeLocation
              };
              
              // Store result for both original and trimmed keys
              result[rawName] = userResult;
              if (rawName !== name) {
                result[name] = userResult;
              }
              
              logger.info(`✅ Resolved "${name}" via fuzzy display name: ${selectedUser.displayName} (${selectedUser.id})`);
              return;
            }
          } catch (error) {
            logger.warn(`Fuzzy display name lookup failed for ${name}:`, error);
          }

          // No match found - store null for both keys
          result[rawName] = null;
          if (rawName !== name) {
            result[name] = null;
          }
          logger.warn(`❌ Could not resolve display name: "${name}"`);

        } catch (error) {
          logger.error(`Error resolving display name "${name}":`, error);
          result[rawName] = null;
          if (rawName !== name) {
            result[name] = null;
          }
        }
      })
    );

    // DEBUG: Log the final resolution results
    const resolved = Object.entries(result).filter(([_, user]) => user !== null).length;
    const total = displayNames.length;
    logger.info(`Display name resolution complete: ${resolved}/${total} users resolved`);

    return result;
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Graph service cache cleared');
  }

  async getProfilePhoto(aadId: string): Promise<Buffer | null> {
    try {
      // Check cache first
      const cached = this.photoCache.get(aadId);
      if (cached && this.isValidCacheEntry({ data: cached.data as any, expiry: cached.expiry })) {
        logger.info(`Profile photo served from cache for user: ${aadId}`);
        return cached.data;
      }

      const client = await this.getClient();
      
      try {
        logger.info(`Attempting to fetch profile photo for user: ${aadId}`);
        
        // Try to get the photo
        const arrayBuffer = await client
          .api(`/users/${aadId}/photo/$value`)
          .responseType(ResponseType.ARRAYBUFFER)
          .get();

        const photoBuffer = Buffer.from(arrayBuffer);

        // Cache the result
        this.photoCache.set(aadId, {
          data: photoBuffer,
          expiry: Date.now() + this.PHOTO_CACHE_DURATION,
        });

        logger.info(`Retrieved profile photo for user: ${aadId} (${photoBuffer.length} bytes)`);
        return photoBuffer;
      } catch (photoError: any) {
        logger.error(`Detailed photo error for ${aadId}:`, {
          code: photoError?.code,
          status: photoError?.status,
          statusCode: photoError?.statusCode,
          message: photoError?.message,
          body: photoError?.body,
          response: photoError?.response?.data,
          headers: photoError?.response?.headers,
        });
        
        if (photoError?.code === 'Request_ResourceNotFound' || 
            photoError?.code === 'ImageNotFound' ||
            photoError?.status === 404 ||
            photoError?.statusCode === 404) {
          // User has no profile photo - cache this result too and don't log as error
          this.photoCache.set(aadId, {
            data: null,
            expiry: Date.now() + this.PHOTO_CACHE_DURATION,
          });
          logger.debug(`No profile photo found for user: ${aadId} (this is normal)`);
          return null;
        }
        
        // Log actual errors (not 404s)
        logger.error(`Error fetching profile photo for ${aadId}:`, {
          code: photoError?.code,
          status: photoError?.status,
          message: photoError?.message,
        });
        throw photoError;
      }
    } catch (error: any) {
      logger.error('Unexpected error getting profile photo:', {
        aadId,
        code: error?.code,
        status: error?.status,
        statusCode: error?.statusCode,
        message: error?.message,
        stack: error?.stack,
      });
      
      // Always return null for any error (don't throw)
      return null;
    }
  }

  async getProfilePhotoMetadata(aadId: string): Promise<{ width: number; height: number; contentType: string } | null> {
    try {
      const client = await this.getClient();
      
      const photoMetadata = await client
        .api(`/users/${aadId}/photo`)
        .get();

      return {
        width: photoMetadata.width,
        height: photoMetadata.height,
        contentType: photoMetadata['@odata.mediaContentType'] || 'image/jpeg',
      };
    } catch (error: any) {
      if (error?.code === 'Request_ResourceNotFound' || error?.code === 'ImageNotFound') {
        return null;
      }
      logger.error('Error getting profile photo metadata:', error);
      return null;
    }
  }

  clearPhotoCache(): void {
    this.photoCache.clear();
    logger.info('Graph service photo cache cleared');
  }

  // Debug method to test Graph API permissions
  async testPhotoPermissions(aadId: string): Promise<{ hasPermission: boolean; error?: string }> {
    try {
      const client = await this.getClient();
      
      // First try to get user basic info
      const user = await client
        .api(`/users/${aadId}`)
        .select(['id', 'displayName'])
        .get();
      
      logger.info(`User found: ${user.displayName} (${user.id})`);
      
      // Then try to get photo metadata (requires less permissions than actual photo)
      try {
        const photoMeta = await client
          .api(`/users/${aadId}/photo`)
          .get();
        
        logger.info(`Photo metadata available:`, {
          width: photoMeta.width,
          height: photoMeta.height,
          contentType: photoMeta['@odata.mediaContentType'],
        });
        
        return { hasPermission: true };
      } catch (photoError: any) {
        if (photoError?.code === 'Request_ResourceNotFound' || photoError?.code === 'ImageNotFound') {
          logger.info(`User has no profile photo (this is normal)`);
          return { hasPermission: true };
        }
        
        logger.error(`Photo permission error:`, {
          code: photoError?.code,
          status: photoError?.status,
          message: photoError?.message,
        });
        
        return { 
          hasPermission: false, 
          error: `Photo access error: ${photoError?.code || photoError?.message}` 
        };
      }
    } catch (error: any) {
      logger.error(`User access error:`, {
        code: error?.code,
        status: error?.status,
        message: error?.message,
      });
      
      return { 
        hasPermission: false, 
        error: `User access error: ${error?.code || error?.message}` 
      };
    }
  }

  // Check what permissions/scopes we have
  async checkPermissions(): Promise<{ scopes: string[]; error?: string }> {
    try {
      const client = await this.getClient();
      
      // Try to get app information to see what permissions we have
      try {
        const appInfo = await client
          .api('/me')
          .get();
        
        logger.info('App context:', {
          appDisplayName: appInfo?.displayName,
          appId: appInfo?.appId,
        });
        
        return { scopes: ['App context retrieved'] };
      } catch (error: any) {
        // Try alternative approach - check what we can access
        const testResults = [];
        
        // Test basic user read
        try {
          await client.api('/users').top(1).get();
          testResults.push('User.Read.All');
        } catch (e) {
          logger.debug('No User.Read.All permission');
        }
        
        // Test directory read
        try {
          await client.api('/directoryObjects').top(1).get();
          testResults.push('Directory.Read.All');
        } catch (e) {
          logger.debug('No Directory.Read.All permission');
        }
        
        return { scopes: testResults };
      }
    } catch (error: any) {
      logger.error('Error checking permissions:', error);
      return { 
        scopes: [], 
        error: `Permission check failed: ${error?.message}` 
      };
    }
  }

  async getDistinctLocations(): Promise<LocationData[]> {
    try {
      const client = await this.getClient();
      
      logger.info('Fetching all users to extract distinct locations...');
      
      // First, let's try a simple test query to see if we can access users at all
      try {
        logger.info('Testing basic user access...');
        const testResponse = await client.api('/users').top(1).get();
        logger.info(`Test query successful. Found ${testResponse.value.length} users.`);
      } catch (testError: any) {
        logger.error('Basic user access test failed:', {
          code: testError?.code,
          status: testError?.status,
          message: testError?.message,
          body: testError?.body,
        });
        throw new Error(`Cannot access users from Azure AD: ${testError?.message || 'Unknown error'}`);
      }
      
      // Fetch all users with location data
      // Use pagination to handle large user bases
      let allUsers: any[] = [];
      
      // Try different approaches to get user location data
      const queries = [
        // First try: filter for users with both city and state
        '/users?$select=city,state,country&$filter=city ne null and state ne null',
        // Fallback: just get users with city data
        '/users?$select=city,state,country&$filter=city ne null',
        // Last resort: get all users and filter client-side
        '/users?$select=city,state,country'
      ];
      
      let successful = false;
      
      for (let queryIndex = 0; queryIndex < queries.length && !successful; queryIndex++) {
        let nextLink = queries[queryIndex];
        let pageCount = 0;
        let queryUsers: any[] = [];
        
        logger.info(`Trying query ${queryIndex + 1}: ${nextLink}`);
        
        try {
          while (nextLink && pageCount < 10) { // Limit to 10 pages for safety
            try {
              logger.info(`Fetching page ${pageCount + 1} from query ${queryIndex + 1}`);
              const response = await client.api(nextLink).get();
              
              if (!response || !response.value) {
                logger.warn('Invalid response from Graph API:', response);
                break;
              }
              
              queryUsers = queryUsers.concat(response.value);
              nextLink = response['@odata.nextLink'];
              pageCount++;
              
              // Log progress
              logger.info(`Query ${queryIndex + 1}, Page ${pageCount}: fetched ${response.value.length} users, total: ${queryUsers.length}`);
              
              // Log sample data from first page of first successful query
              if (pageCount === 1 && queryIndex === 0 && response.value.length > 0) {
                logger.info('Sample user data:', {
                  sampleUser: response.value[0],
                  totalInPage: response.value.length,
                });
              }
            } catch (pageError: any) {
              logger.error(`Error fetching page ${pageCount + 1} from query ${queryIndex + 1}:`, {
                code: pageError?.code,
                status: pageError?.status,
                message: pageError?.message,
                body: pageError?.body,
                url: nextLink,
              });
              break;
            }
          }
          
          if (queryUsers.length > 0) {
            allUsers = queryUsers;
            successful = true;
            logger.info(`Query ${queryIndex + 1} successful: found ${allUsers.length} users`);
          } else {
            logger.warn(`Query ${queryIndex + 1} returned no users, trying next approach...`);
          }
          
        } catch (queryError: any) {
          logger.error(`Query ${queryIndex + 1} failed completely:`, {
            code: queryError?.code,
            status: queryError?.status,
            message: queryError?.message,
            body: queryError?.body,
          });
        }
             }
      
      if (!successful) {
        logger.warn('All query approaches failed, no users found with location data');
      }
      
      logger.info(`Fetched total of ${allUsers.length} users from Azure AD`);
      
      if (allUsers.length === 0) {
        logger.warn('No users found with location data. This might be expected if users do not have city/state fields populated.');
        return [];
      }
      
      // Extract unique locations
      const locationSet = new Set<string>();
      const locations: LocationData[] = [];
      
      for (const user of allUsers) {
        if (user.city && user.state) {
          const country = user.country || 'Canada'; // Default to Canada
          const rawProvince = user.state; // Azure AD uses "state" field
          const normalizedProvince = normalizeProvince(rawProvince, country); // Normalize province format
          const city = user.city;
          
          const locationKey = `${city}|${normalizedProvince}|${country}`;
          
          if (!locationSet.has(locationKey)) {
            locationSet.add(locationKey);
            locations.push({
              city,
              province: normalizedProvince,
              country,
            });
          }
        }
      }
      
      logger.info(`Found ${locations.length} distinct locations from ${allUsers.length} users`);
      
      // Sort by country, then province, then city
      locations.sort((a, b) => {
        if (a.country !== b.country) return a.country.localeCompare(b.country);
        if (a.province !== b.province) return a.province.localeCompare(b.province);
        return a.city.localeCompare(b.city);
      });
      
      return locations;
    } catch (error: any) {
      logger.error('Error fetching distinct locations from Azure AD:', {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        stack: error?.stack,
      });
      throw new Error(`Failed to fetch locations from Azure AD: ${error?.message || 'Unknown error'}`);
    }
  }
}

export const graphService = new GraphService();
export type { StaffMember, LocationData }; 