// Unsigned Cloudinary upload for store photos. Cloud name + preset are not
// secrets (the API secret stays on the Cloudinary account); the preset is
// restricted to images on the account side.
const CLOUD_NAME = 'ojpc628z';
const UPLOAD_PRESET = 'floq_store_photos';

/** Upload a local image URI, return the hosted secure URL. */
export async function uploadStoreImage(uri: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri, type: 'image/jpeg', name: 'store.jpg' } as any);
  form.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Image upload failed. Check your connection and try again.');
  const data = await res.json();
  if (!data.secure_url) throw new Error('Image upload failed');
  return data.secure_url as string;
}
