import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { staffApi } from '../services/api';

// Hook to fetch a staff member's profile photo (Azure AD)
const useProfilePhoto = (azureAdId?: string) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!azureAdId || attempted) return;

    const load = async () => {
      setIsLoading(true);
      setAttempted(true);
      try {
        const blob = await staffApi.getProfilePhoto(azureAdId);
        const url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          setError('Failed to load photo');
          // eslint-disable-next-line no-console
          console.error('Profile photo error', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();

    // cleanup
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [azureAdId, attempted]);

  // reset when id changes
  useEffect(() => {
    setAttempted(false);
    setPhotoUrl(null);
    setError(null);
  }, [azureAdId]);

  return { photoUrl, isLoading, error };
};

interface Props {
  azureAdId?: string;
  displayName?: string;
  size?: 'xs' | 'sm' | 'lg';
  className?: string;
}

const ProfilePicture: React.FC<Props> = ({ azureAdId, displayName, size = 'sm', className }) => {
  const { photoUrl } = useProfilePhoto(azureAdId);

  const sizeClasses: Record<Required<Props>['size'], string> = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-xl',
  } as const;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName ?? 'User'}
        className={clsx(
          sizeClasses[size],
          'rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0',
          size === 'lg' && 'border-4 shadow-lg',
          className,
        )}
        onError={() => {
          /* silently fall back to initials */
        }}
      />
    );
  }

  return (
    <div
      className={clsx(
        sizeClasses[size],
        'bg-gradient-to-br from-brand-500 to-navy-600 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 border-2 border-white shadow-sm',
        size === 'lg' && 'border-4 shadow-lg',
        className,
      )}
    >
      {getInitials(displayName)}
    </div>
  );
};

export default ProfilePicture; 