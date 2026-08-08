import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase/firebaseClient';

export type QuestionMediaRole = 'imageUrl' | 'revealImageUrl';

export const uploadQuestionMedia = async ({
  questionId,
  mediaUri,
  role,
}: {
  questionId: string;
  mediaUri: string;
  role: QuestionMediaRole;
}) => {
  if (mediaUri.startsWith('http://') || mediaUri.startsWith('https://')) {
    return mediaUri;
  }

  const response = await fetch(mediaUri);
  const blob = await response.blob();
  const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const cleanId = questionId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const mediaRef = ref(getFirebaseStorage(), `questionMedia/${cleanId}/${role}-${Date.now()}.${extension}`);

  await uploadBytes(mediaRef, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
    customMetadata: { questionId, role },
  });

  return getDownloadURL(mediaRef);
};

export const uploadAdminImage = async ({
  folder,
  itemId,
  mediaUri,
  role,
}: {
  folder: 'categoryMedia' | 'sponsorMedia';
  itemId: string;
  mediaUri: string;
  role: string;
}) => {
  if (mediaUri.startsWith('http://') || mediaUri.startsWith('https://')) {
    return mediaUri;
  }

  const response = await fetch(mediaUri);
  const blob = await response.blob();
  const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const cleanId = itemId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const mediaRef = ref(getFirebaseStorage(), `${folder}/${cleanId}/${role}-${Date.now()}.${extension}`);

  await uploadBytes(mediaRef, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
    customMetadata: { itemId, role },
  });

  return getDownloadURL(mediaRef);
};