import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Loader } from 'lucide-react';
import logoImage from '../logo.png';
import './Login.css';

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tus credenciales');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await login(username, password);
    
    if (!result.success) {
      setError(result.message);
      setIsLoading(false);
    }
    // If success, AuthContext will update user state and App.jsx will re-render main layout
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container" style={{ background: 'transparent' }}>
            <img src={logoImage} alt="A.R.I.A Logo" style={{ width: '60px', height: '60px', zIndex: 1, filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))' }} />
            <div className="login-logo-pulse"></div>
          </div>
          <h1>A.R.I.A</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label>Nombre de Usuario</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                autoComplete="username"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={isLoading}>
            {isLoading ? <Loader size={20} className="spin" /> : 'Autenticar'}
          </button>
        </form>
        
        <div className="login-footer">
          Acceso Restringido. Monitoreado bajo protocolo IAM.
        </div>
      </div>
    </div>
  );
}

export default Login;
