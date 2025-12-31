# Public-Facing API Tools

This subset of tools plays a direct role in the **user experience (UX)** and **interaction** with the general public.

## 1. Identity & Access (Public Entry Point)
*   **Clerk / Auth0**: The first interaction users have. Critical for a smooth signup flow.
*   **WorkOS**: Essential if "public" includes Enterprise clients wanting SSO.

## 2. Communication (Outreach to Public)
*   **Resend / SendGrid**: Sending emails (Welcome, Reset Password, Newsletters).
*   **Twilio**: SMS verification or notifications.
*   **Novu**: Managing the notification center (bell icon) users see.

## 3. Feedback & Interaction
*   **Typeform**: Collecting data/feedback from public users (visually improved forms).
*   **Calendly**: Letting the public book meetings with you/mentors.
*   **Mapbox**: Showing locations to users (e.g., event maps).

## 4. Trust & Legal (Public Documents)
*   **DocuSign / PandaDoc**: If users need to sign contracts or agreements publicly.
*   **Stripe / PayPal**: The visible checkout experience.

## 5. User Privacy & Monitoring
*   **Plausible**: Public-facing because it respects their privacy (GDPR friendly) unlike traditional trackers.
*   **Sentry / LogRocket**: Ensuring the public user doesn't face crashes (silent but critical).
