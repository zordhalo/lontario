"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/contexts/AuthContext";
import { useUpdateProfile } from "@/hooks/use-profile";
import { AvatarUpload } from "@/components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Json } from "@/types";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    candidate: "Candidate",
    recruiter: "Recruiter",
    hiring_manager: "Hiring Manager",
    admin: "Admin",
  };
  return labels[role] ?? role;
}

function getInitials(name: string | null, email: string | undefined): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.charAt(0).toUpperCase() ?? "U";
}

interface NotificationPrefs {
  email_new_candidates?: boolean;
  email_interview_complete?: boolean;
  email_weekly_digest?: boolean;
}

function parseNotificationPrefs(prefs: Json): NotificationPrefs {
  if (prefs && typeof prefs === "object" && !Array.isArray(prefs)) {
    return prefs as unknown as NotificationPrefs;
  }
  return {
    email_new_candidates: true,
    email_interview_complete: true,
    email_weekly_digest: false,
  };
}

export default function ProfilePage() {
  const { profile, user, isLoading, hasRole } = useAuth();
  const { updateProfile, uploadAvatar, isUpdating, error } = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    email_new_candidates: true,
    email_interview_complete: true,
    email_weekly_digest: false,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCompanyName(profile.company_name ?? "");
      setTimezone(profile.timezone ?? "America/New_York");
      setNotificationPrefs(parseNotificationPrefs(profile.notification_preferences));
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await updateProfile({
      full_name: fullName || null,
      company_name: companyName || null,
      timezone,
      notification_preferences: notificationPrefs as unknown as Json,
    });

    if (result) {
      toast.success("Profile updated successfully");
    } else {
      toast.error(error ?? "Failed to update profile");
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const result = await uploadAvatar(file);
    if (result) {
      toast.success("Avatar updated");
    } else {
      toast.error(error ?? "Failed to upload avatar");
    }
  };

  const toggleNotification = (key: keyof NotificationPrefs) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const showCompanyField = hasRole(["recruiter", "hiring_manager", "admin"]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
          {profile?.role && (
            <Badge variant="secondary">{getRoleLabel(profile.role)}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account information and preferences
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Avatar */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Photo</h2>
          <AvatarUpload
            avatarUrl={profile?.avatar_url ?? null}
            fallback={getInitials(profile?.full_name ?? null, user?.email)}
            onUpload={handleAvatarUpload}
            isUploading={isUpdating}
          />
        </section>

        {/* Personal Information */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email ?? ""}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            {showCompanyField && (
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company"
                />
              </div>
            )}
          </div>
        </section>

        {/* Timezone */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Timezone</h2>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Notification Preferences */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">New Candidates</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when new candidates apply
                </p>
              </div>
              <Switch
                checked={notificationPrefs.email_new_candidates ?? true}
                onCheckedChange={() => toggleNotification("email_new_candidates")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Interview Complete</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when AI interviews are completed
                </p>
              </div>
              <Switch
                checked={notificationPrefs.email_interview_complete ?? true}
                onCheckedChange={() => toggleNotification("email_interview_complete")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a weekly summary of hiring activity
                </p>
              </div>
              <Switch
                checked={notificationPrefs.email_weekly_digest ?? false}
                onCheckedChange={() => toggleNotification("email_weekly_digest")}
              />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
