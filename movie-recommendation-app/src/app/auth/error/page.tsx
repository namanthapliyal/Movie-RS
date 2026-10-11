export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-lg bg-destructive/20 text-destructive flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Authentication Error
        </h2>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Please check your credentials and try again.
        </p>
        <div className="mt-6">
          <a
            href="/auth/signin"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
          >
            Try Again
          </a>
        </div>
      </div>
    </div>
  );
}