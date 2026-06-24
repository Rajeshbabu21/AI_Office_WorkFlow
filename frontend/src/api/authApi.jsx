import api from './axios.jsx';

/**
 * Log in the user using standard OAuth2 Password flow (form URL encoded).
 */
export const login = async (email, password) => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const response = await api.post('/user_login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (response.data && response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
  }
  return response.data;
};

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




