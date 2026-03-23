import { Component } from '../base/Component';
import { signIn, sendPasswordReset } from '../../services/AuthService';

export class LoginPageComponent extends Component {
  #onLogin: () => void;

  constructor(container: HTMLElement, onLogin: () => void) {
    super(container);
    this.#onLogin = onLogin;
  }

  render(): string {
    return `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="nav__logo-icon" style="margin:0 auto 8px">P</div>
            <span class="auth-logo-text">The Pentaclub</span>
          </div>

          <div id="loginView">
            <h2 class="auth-title">Admin Login</h2>
            <div id="loginError" class="auth-feedback auth-feedback--error hidden"></div>
            <form id="loginForm" class="auth-form" novalidate>
              <div class="form-group">
                <label for="loginEmail">Email</label>
                <input type="email" id="loginEmail" required autocomplete="email" placeholder="admin@example.com">
              </div>
              <div class="form-group">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" required autocomplete="current-password" placeholder="••••••••">
              </div>
              <button type="submit" class="auth-btn" id="loginBtn">Sign In</button>
            </form>
            <button class="auth-link" id="showForgot">Forgot password?</button>
          </div>

          <div id="forgotView" class="hidden">
            <h2 class="auth-title">Reset Password</h2>
            <p class="auth-subtitle">Enter your email and we'll send you a reset link.</p>
            <div id="forgotSuccess" class="auth-feedback auth-feedback--success hidden"></div>
            <div id="forgotError" class="auth-feedback auth-feedback--error hidden"></div>
            <form id="forgotForm" class="auth-form" novalidate>
              <div class="form-group">
                <label for="forgotEmail">Email</label>
                <input type="email" id="forgotEmail" required autocomplete="email" placeholder="admin@example.com">
              </div>
              <button type="submit" class="auth-btn" id="forgotBtn">Send Reset Link</button>
            </form>
            <button class="auth-link" id="showLogin">← Back to login</button>
          </div>
        </div>
      </div>
    `;
  }

  afterMount(): void {
    document.getElementById('showForgot')?.addEventListener('click', () => {
      document.getElementById('loginView')?.classList.add('hidden');
      document.getElementById('forgotView')?.classList.remove('hidden');
    });

    document.getElementById('showLogin')?.addEventListener('click', () => {
      document.getElementById('forgotView')?.classList.add('hidden');
      document.getElementById('loginView')?.classList.remove('hidden');
    });

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn') as HTMLButtonElement;
      const errorEl = document.getElementById('loginError')!;
      const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
      const password = (document.getElementById('loginPassword') as HTMLInputElement).value;

      btn.disabled = true;
      btn.textContent = 'Signing in…';
      errorEl.classList.add('hidden');

      try {
        await signIn(email, password);
        this.#onLogin();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Login failed';
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('forgotBtn') as HTMLButtonElement;
      const errorEl = document.getElementById('forgotError')!;
      const successEl = document.getElementById('forgotSuccess')!;
      const email = (document.getElementById('forgotEmail') as HTMLInputElement).value;

      btn.disabled = true;
      btn.textContent = 'Sending…';
      errorEl.classList.add('hidden');
      successEl.classList.add('hidden');

      try {
        await sendPasswordReset(email);
        successEl.textContent = 'Check your email for a reset link.';
        successEl.classList.remove('hidden');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send reset email';
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
      }
    });
  }
}
