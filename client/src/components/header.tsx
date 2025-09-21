import { BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";

type User = {
  firstName: string;
  lastName: string;
  emailAddress: string;
};

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      // no session → redirect to login
      window.location.href = "/login";
    }
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Safety Stock Calculator
              </h1>
              <p className="text-sm text-gray-500">
                Professional Supply Chain Analytics
              </p>
            </div>
          </div>
          <div className="flex justify-baseline items-center">
            <p className="mx-4">
              {user
                ? user.firstName.toUpperCase() +
                  " " +
                  user.lastName.toUpperCase()
                : "Not Logged In"}
            </p>
            <button
              type="button"
              className="text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300 font-medium rounded-full text-sm px-5 py-2.5 text-center me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900"
              onClick={() => {
                sessionStorage.clear();
                window.location.href = "/login";
              }}
            >
              LogOut
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
