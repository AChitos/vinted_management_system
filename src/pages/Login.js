import React, { useState } from 'react';
import axios from 'axios';
import { Typography, TextField, Button, Checkbox, FormControlLabel, Link } from '@mui/material';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = () => {
    console.log('Attempting login with:', { username, password, rememberMe });
    axios.post('http://127.0.0.1:5000/login', { username, password })
      .then(response => {
        console.log('Login response:', response);
        alert('Login successful');
      })
      .catch(error => {
        console.error('Login error:', error);
        alert('Invalid credentials');
      });
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Login
      </Typography>
      <TextField
        label="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        fullWidth
        margin="normal"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            color="primary"
          />
        }
        label="Remember Me"
      />
      <Button variant="contained" color="primary" onClick={handleLogin}>
        Login
      </Button>
      <Link href="#" variant="body2">
        Forgot Password?
      </Link>
    </div>
  );
}

export default Login;