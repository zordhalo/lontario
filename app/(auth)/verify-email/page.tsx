/**
 * @fileoverview Verify Email Page
 *
 * Displays email verification status and provides option to resend.
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { VerifyEmailForm } from "./verify-email-form";

function VerifyEmailLoading() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<VerifyEmailLoading />}>
            <VerifyEmailForm />
        </Suspense>
    );
}
