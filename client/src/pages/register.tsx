import { Link } from "react-router-dom";
import { FormEvent, useState } from "react";

export default function Register() {
    const [firstName, setFirstName] = useState<string>("");
    const [lastName, setLastName] = useState<string>("");
    const [emailAddress, setEmailAddress] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirm, setConfirm] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);


    const validate = () => {
        if (!firstName.trim() || !lastName.trim() ||!emailAddress.trim() || !password) {
          setError("All fields are required.");
          return false;
        }
        // simple email regex
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(emailAddress)) {
          setError("Please enter a valid email address.");
          return false;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return false;
        }
        if (password !== confirm) {
          setError("Passwords do not match.");
          return false;
        }
        return true;
      };


  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Register with", firstName, lastName, emailAddress, password);
    // TODO: Call backend API
    setError(null);
    setSuccess(null);


    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, emailAddress, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // backend should send { error: "message" }
        setError(data?.error ?? "Registration failed");
      } else {
        setSuccess("Registration successful — redirecting to login...");
        // small delay so user sees success message
        setTimeout(() => {
          // redirect to login page
          window.location.href = "/login";
        }, 900);
      }
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) setError(err.message);
      else setError("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded-2xl shadow-md w-96"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
        <p className="text-center text-red-600 my-4">{error?error:""}</p>
        <input
          type="text"
          placeholder="First Name"
          className="w-full p-3 border rounded mb-4"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Last Name"
          className="w-full p-3 border rounded mb-4"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 border rounded mb-4"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 border rounded mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder=" Confirm Password"
          className="w-full p-3 border rounded mb-4"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-green-600 text-white p-3 rounded hover:bg-green-700"
        >
          Register
        </button>
        <p className="mt-4 text-sm text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
function setLoading(arg0: boolean) {
    throw new Error("Function not implemented.");
}

