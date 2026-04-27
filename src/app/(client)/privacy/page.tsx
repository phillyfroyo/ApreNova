// src/app/(client)/privacy/page.tsx
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Cuentana',
  description: 'Privacy Policy for Cuentana - Learn languages through stories',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'December 29, 2025';
  const contactEmail = 'philipwooleryprice@gmail.com';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Welcome to Cuentana (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy
              and personal information. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our language learning application and website
              (collectively, the &quot;Service&quot;).
            </p>
            <p className="text-gray-700">
              By using our Service, you agree to the collection and use of information in accordance
              with this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Account Information:</strong> When you create an account, we collect your name, email address, and password (if using email/password authentication).</li>
              <li><strong>Profile Information:</strong> Your language preferences, learning level, and quiz results.</li>
              <li><strong>Learning Data:</strong> Stories you&apos;ve read, pages completed, bookmarks, and progress information.</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.2 Information from Third-Party Authentication</h3>
            <p className="text-gray-700 mb-2">
              If you choose to sign in using Google or Facebook, we receive:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Your name and email address</li>
              <li>Profile picture (if available)</li>
              <li>Account identifier from the authentication provider</li>
            </ul>
            <p className="text-gray-700 mt-2">
              We do not receive or store your passwords from these services.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.3 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Usage Data:</strong> Time spent learning, session duration, and feature usage.</li>
              <li><strong>Device Information:</strong> Browser type, device type, and operating system.</li>
              <li><strong>Log Data:</strong> IP address, access times, and pages viewed.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-2">We use the collected information to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Provide, maintain, and improve our Service</li>
              <li>Personalize your learning experience based on your level and preferences</li>
              <li>Track your progress and save your place in stories</li>
              <li>Send you important updates about your account or the Service</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Analyze usage patterns to improve our content and features</li>
              <li>Protect against fraudulent or unauthorized activity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">
              We do not sell your personal information. We may share your information only in the
              following circumstances:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Service Providers:</strong> With trusted third parties who help us operate our Service (e.g., hosting, analytics, email delivery).</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Services</h2>
            <p className="text-gray-700 mb-2">Our Service integrates with the following third-party services:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Google Sign-In:</strong> For authentication. Subject to <a href="https://policies.google.com/privacy" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>.</li>
              <li><strong>Facebook Login:</strong> For authentication. Subject to <a href="https://www.facebook.com/privacy/policy/" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">Meta&apos;s Privacy Policy</a>.</li>
              <li><strong>Analytics Services:</strong> To understand how users interact with our Service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p className="text-gray-700">
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction. This
              includes encryption of data in transit and at rest, secure authentication methods, and
              regular security assessments. However, no method of transmission over the Internet is
              100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p className="text-gray-700">
              We retain your personal information for as long as your account is active or as needed
              to provide you with our Service. You may request deletion of your account and associated
              data at any time by contacting us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
            <p className="text-gray-700 mb-2">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise these rights, please contact us at{' '}
              <a href={`mailto:${contactEmail}`} className="text-indigo-600 hover:underline">{contactEmail}</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
            <p className="text-gray-700">
              Our Service is not directed to children under 13 years of age. We do not knowingly
              collect personal information from children under 13. If you are a parent or guardian
              and believe your child has provided us with personal information, please contact us
              so we can delete such information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. International Data Transfers</h2>
            <p className="text-gray-700">
              Your information may be transferred to and processed in countries other than your own.
              These countries may have different data protection laws. We ensure appropriate safeguards
              are in place to protect your information in accordance with this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p className="text-gray-700">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-gray-700 mt-2">
              <strong>Email:</strong>{' '}
              <a href={`mailto:${contactEmail}`} className="text-indigo-600 hover:underline">{contactEmail}</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/" className="text-indigo-600 hover:underline">
            ← Back to Cuentana
          </Link>
        </div>
      </div>
    </div>
  );
}
