import api from './axios.jsx';




/**
 * Register a new user in the database.
 */
export const register = async (email, password, fullName, department, employeeId, googleAccessToken) => {
  const response = await api.post('/register_users', {
    email,
    password_hash: password, // Backend hashes the password
    full_name: fullName,
    role: 'employee',
    department,
    employee_id: employeeId,
    google_access_token: googleAccessToken
  });

  if (response.data && response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
  }
  return response.data;
};


/**
 * Log out the user.
 */
export const logout = () => {
  localStorage.removeItem('token');
};

/**
 * Send Google token to backend to log in.
 */
export const loginWithGoogle = async (googleToken) => {
  const response = await api.post('/auth/google', {
    token: googleToken
  });
  if (response.data && response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
  }
  return response.data;
};




