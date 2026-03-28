export const validateAdminPassword = (password) => {
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 30 * 1000; // 30 seconds
  const CORRECT_PASSWORD = "2051";

  const now = Date.now();
  const lockoutTime = parseInt(localStorage.getItem('admin_lockout_time') || '0');
  let attempts = parseInt(localStorage.getItem('admin_attempts') || '0');

  // Check if locked out
  if (now < lockoutTime) {
    const remaining = Math.ceil((lockoutTime - now) / 1000);
    return {
      isValid: false,
      message: `Bloqueado. Tente novamente em ${remaining}s`,
      attemptsRemaining: 0,
      isLocked: true,
      lockoutTimeRemaining: remaining
    };
  }

  // If lockout expired, reset attempts
  if (now >= lockoutTime && attempts >= MAX_ATTEMPTS) {
     attempts = 0;
     localStorage.setItem('admin_attempts', '0');
     localStorage.removeItem('admin_lockout_time');
  }

  if (password === CORRECT_PASSWORD) {
    localStorage.setItem('admin_attempts', '0');
    localStorage.removeItem('admin_lockout_time');
    return {
      isValid: true,
      message: 'Senha correta',
      attemptsRemaining: MAX_ATTEMPTS,
      isLocked: false,
      lockoutTimeRemaining: 0
    };
  } else {
    attempts += 1;
    localStorage.setItem('admin_attempts', attempts.toString());

    if (attempts >= MAX_ATTEMPTS) {
      const newLockoutTime = now + LOCKOUT_DURATION;
      localStorage.setItem('admin_lockout_time', newLockoutTime.toString());
      return {
        isValid: false,
        message: `Muitas tentativas incorretas. Bloqueado por 30s.`,
        attemptsRemaining: 0,
        isLocked: true,
        lockoutTimeRemaining: 30
      };
    }

    return {
      isValid: false,
      message: 'Senha incorreta',
      attemptsRemaining: MAX_ATTEMPTS - attempts,
      isLocked: false,
      lockoutTimeRemaining: 0
    };
  }
};