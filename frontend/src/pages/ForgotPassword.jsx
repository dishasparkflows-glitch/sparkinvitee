import { useState } from 'react';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: implement real API call
    console.log('Forgot password for:', email);
    setSubmitted(true);
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h1>
        <p className="text-sm text-gray-500">
          {submitted 
            ? "If an account exists, a reset link has been sent to your email."
            : "Enter your email address and we'll send you a link to reset your password."}
        </p>
      </div>
      
      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="Enter your email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-[var(--color-primary)] text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Send Reset Link
          </button>
        </form>
      ) : (
        <div className="flex justify-center">
          <Link to="/login" className="w-full text-center bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors">
            Return to Login
          </Link>
        </div>
      )}
      
      {!submitted && (
        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-[var(--color-primary)] hover:underline font-medium">
            Back to Login
          </Link>
        </div>
      )}
    </div>
  );
};

export default ForgotPassword;
