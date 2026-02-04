"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AvatarUploadProps {
  avatarUrl: string | null;
  fallback: string;
  onUpload: (file: File) => void;
  isUploading?: boolean;
}

export function AvatarUpload({
  avatarUrl,
  fallback,
  onUpload,
  isUploading,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="size-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
          <AvatarFallback className="text-lg">{fallback}</AvatarFallback>
        </Avatar>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="absolute -bottom-1 -right-1 rounded-full shadow-sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          <Camera className="size-3.5" />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Change photo"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 2MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
