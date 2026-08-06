import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase/firebaseClient';

export const uploadProfileAvatar = async (userId: string, avatarUri: string) => {
  if (avatarUri.startsWith('http://') || avatarUri.startsWith('https://')) {
    return avatarUri;
  }

  const response = await fetch(avatarUri);
  const blob = await response.blob();
  const extension = blob.type.includes('png') ? 'png' : 'jpg';
  const avatarRef = ref(getFirebaseStorage(), `profileAvatars/${userId}/avatar.${extension}`);

  await uploadBytes(avatarRef, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(avatarRef);
};