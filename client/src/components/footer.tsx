export default function Footer() {
  // Footer
  return (
    <footer className="bg-white border-t border-gray-200 mt-16 bottom-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-gray-500">
            ©{new Date().getFullYear()} Copyrights reserved.
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <div className="text-center">
              Made with ❤️ — Toolbox.
            </div>
            <div>v1.0</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
