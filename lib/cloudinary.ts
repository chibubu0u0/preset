import { optionalEnv, requiredEnv } from "./env";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

export async function uploadToCloudinary(file: File, label: "original" | "edited"): Promise<CloudinaryUploadResult> {
  const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
  const uploadPreset = requiredEnv("CLOUDINARY_UPLOAD_PRESET");
  const folder = optionalEnv("CLOUDINARY_FOLDER", "eric-tone-dataset");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const formData = new FormData();
  formData.append("file", dataUri);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `${folder}/${label}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Cloudinary upload failed: ${data?.error?.message || JSON.stringify(data)}`);
  }

  return data as CloudinaryUploadResult;
}
