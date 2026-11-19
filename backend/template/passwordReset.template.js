/**
 * Password Reset Email Template
 * @param {Object} params
 * @param {string} params.resetLink - The URL to reset password
 * @param {string} [params.userName] - The user's name
 * @param {string} [params.storeName] - Store or company name (defaults to 'SparkInvitee')
 * @returns {string} HTML string
 */
export const passwordResetTemplate = ({
  resetLink,
  userName = '',
  storeName = process.env.STORE_NAME || 'SparkInvitee',
}) => {
  const currentYear = new Date().getFullYear();
  const greeting = userName ? `Hi ${userName},` : 'Hello,';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password - ${storeName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f5f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #333333;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f5f8;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .header {
      background: linear-gradient(135deg, #4c3963 0%, #362947 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 36px 32px;
    }
    .content h2 {
      margin: 0 0 16px;
      font-size: 20px;
      color: #1f2937;
      font-weight: 600;
    }
    .content p {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 1.6;
      color: #4b5563;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background-color: #4c3963;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 13px 32px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(76, 57, 99, 0.3);
      transition: background-color 0.2s ease;
    }
    .btn:hover {
      background-color: #3d2d50;
    }
    .link-box {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 14px;
      margin: 20px 0;
      word-break: break-all;
      font-size: 12px;
      color: #6b7280;
    }
    .link-box a {
      color: #4c3963;
      text-decoration: underline;
    }
    .security-note {
      border-left: 3px solid #eab308;
      background-color: #fefce8;
      padding: 12px 16px;
      border-radius: 4px;
      margin: 24px 0 0;
    }
    .security-note p {
      margin: 0;
      font-size: 12px;
      color: #713f12;
      line-height: 1.5;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0 0 6px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>${storeName}</h1>
      </div>
      <div class="content">
        <h2>Reset Your Password</h2>
        <p>${greeting}</p>
        <p>We received a request to reset the password associated with your account. Click the button below to choose a new password:</p>
        
        <div class="btn-container">
          <a href="${resetLink}" target="_blank" rel="noopener noreferrer" class="btn">Reset Password</a>
        </div>

        <p style="font-size: 13px; color: #6b7280;">If the button above does not work, copy and paste this link into your browser:</p>
        <div class="link-box">
          <a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a>
        </div>

        <div class="security-note">
          <p><strong>Note:</strong> This link will expire in 24 hours. If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${currentYear} ${storeName}. All rights reserved.</p>
        <p>This is an automated message, please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export default passwordResetTemplate;
