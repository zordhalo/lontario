"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Profile } from "@/types";

type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "full_name"
    | "company_name"
    | "avatar_url"
    | "timezone"
    | "notification_preferences"
  >
>;

export function useUpdateProfile() {
  const { user, refetchProfile } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = async (updates: ProfileUpdate) => {
    if (!user?.id) {
      setError("Not authenticated");
      return null;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      await refetchProfile();
      return data as Profile;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id) {
      setError("Not authenticated");
      return null;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("File must be JPG, PNG, or WebP");
      return null;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError("File must be smaller than 2MB");
      return null;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        const msg = uploadError.message.includes("not found")
          ? "Storage bucket 'avatars' not found. Run the migration: supabase/migrations/20260204_create_avatars_bucket.sql"
          : uploadError.message;
        throw new Error(msg);
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const result = await updateProfile({ avatar_url: urlData.publicUrl });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload avatar";
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateProfile, uploadAvatar, isUpdating, error };
}
