import React from "react";

export const Privacy = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:py-16 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
        Privacy Policy
      </h2>
      <p className="mt-6 max-w-2xl text-xl text-gray-500">
        This Privacy Policy describes how TechNessie (“we,” “us,” or “our”)
        collects, uses, and shares information about you when you use our
        website (the “Site”).
      </p>

      <h3 className="text-lg leading-6 font-medium text-gray-900 mt-8">
        1. Information We Collect
      </h3>
      <p className="mt-4 max-w-2xl text-md text-gray-500">
        When you use Schedule, we store event details, participant names,
        optional email addresses, and submitted availability on the scheduling
        server. Your browser stores recently opened events and private edit
        tokens that let you update the entries you manage without an account or
        password. Other tools may store their preferences locally on your
        device.
      </p>

      <h3 className="text-lg leading-6 font-medium text-gray-900 mt-8">
        2. How We Use Your Information
      </h3>
      <p className="mt-4 max-w-2xl text-md text-gray-500">
        We use scheduling information to show availability, identify overlapping
        times, let participants update their responses, and prepare messages and
        email lists for calendar invitations.
      </p>

      <h3 className="text-lg leading-6 font-medium text-gray-900 mt-8">
        3. Information Sharing
      </h3>
      <p className="mt-4 max-w-2xl text-md text-gray-500">
        Anyone with an event link can view that event’s details, participant
        names, any email addresses they choose to share, and availability. Your
        private edit tokens are not included in the shared event link or
        displayed to other participants. Participants can resume on another
        device by selecting their name and retyping it. This is a courtesy
        confirmation, so anyone with the event link and the displayed name can
        also edit that response.
      </p>

      <h3 className="text-lg leading-6 font-medium text-gray-900 mt-8">
        4. Security
      </h3>
      <p className="mt-4 max-w-2xl text-md text-gray-500">
        We take reasonable measures to help protect information about you from
        loss, theft, misuse and unauthorized access, disclosure, alteration, and
        destruction.
      </p>

      <h3 className="text-lg leading-6 font-medium text-gray-900 mt-8">
        5. Changes to this Policy
      </h3>
      <p className="mt-4 max-w-2xl text-md text-gray-500">
        We may modify this Privacy Policy at any time. If we make material
        changes to this Privacy Policy, we will notify you by updating the date
        of this Privacy Policy and posting it on the Site. We may also provide
        notification of changes in another way that we believe is reasonably
        likely to reach you, such as via e-mail (if you have provided your
        e-mail address).
      </p>

      <h3 className="text-lg leading-6 font-medium text-gray-900 mt-8">
        6. Contact Us
      </h3>
      <p className="mt-4 max-w-2xl text-md text-gray-500">
        If you have any questions or concerns about this Privacy Policy or our
        practices, please contact us at contact@technessie.com.
      </p>
    </div>
  );
};

export default Privacy;
