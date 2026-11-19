import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';
import { sendEmail } from '../utils/emailService.js';
import { passwordResetTemplate } from '../template/passwordReset.template.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) return ApiResponse.error(res, 'Invalid credentials', 401);
    
    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return ApiResponse.error(res, 'Invalid credentials', 401);
    
    // 3. Generate Token
    const token = jwt.sign(
      { id: user._id, email: user.email }, 
      process.env.JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    
    return ApiResponse.success(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits
      }
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return ApiResponse.error(res, 'Server error during login', 500);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      // Return 200 anyway to prevent email enumeration
      return ApiResponse.success(res, null, 'If an account exists, a reset link has been sent.');
    }
    
    // Generate reset token (in a real app, save to DB and send email)
    const resetToken = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    const frontendUrl = process.env.FRONTEND_URL;
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    const html = passwordResetTemplate({
      resetLink,
      userName: user.name,
      storeName: process.env.STORE_NAME || 'SparkInvitee',
    });

    try {
      await sendEmail({
        to: user.email,
        subject: `Password Reset Request - ${process.env.STORE_NAME}`,
        html,
        text: `Hi ${user.name || ''},\n\nPlease use the following link to reset your password:\n${resetLink}\n\nThis link will expire in 24 hours. If you did not request this, please ignore this email.`,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError.message);
    }
    
    return ApiResponse.success(res, null, 'If an account exists, a reset link has been sent.');
  } catch (error) {
    console.error('Forgot password error:', error);
    return ApiResponse.error(res, 'Server error', 500);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // 1. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 2. Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // 3. Update user
    await User.findByIdAndUpdate(decoded.id, { password: hashedPassword });
    
    return ApiResponse.success(res, null, 'Password has been successfully reset');
  } catch (error) {
    console.error('Reset password error:', error);
    return ApiResponse.error(res, 'Invalid or expired token', 400);
  }
};
