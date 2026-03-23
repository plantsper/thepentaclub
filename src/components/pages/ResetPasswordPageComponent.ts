import { Component } from '../base/Component';
import { updatePassword } from '../../services/AuthService';

export class ResetPasswordPageComponent extends Component {
  #onReset: () => void;

  constructor(container: HTMLElement, onReset: () => void) {
    super(container);
    this.#onReset = onReset;
  }

  render(): string {
    return `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="nav__logo-icon" style="margin:0 auto 8px">P</div>
            <span class="auth-logo-text">The Pentaclub</span>
          </div>
          <h2 class="auth-title">Set New Password</h2>
          <div id="resetError" class="auth-feedback auth-feedback--error hidden"></div>
          <div id="resetSuccess" class="auth-feedback auth-feedback--success hidden"></div>
          <form id="resetForm" class="auth-form" novalidate>
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input type="password" id="newPassword" required minlength="8" placeholder="Min. 8 characters">
            </div>
            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" required minlength="8" placeholder="Repeat password">
            </div>
            <button type="submit" class="auth-btn" id="resetBtn">Update Password</button>
          </form>
        </div>
      </div>
    `;
  }

  afterMount(): void {
    document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('resetBtn') as HTMLButtonElement;
      const errorEl = document.getElementById('resetError')!;
      const successEl = document.getElementById('resetSuccess')!;
      const newPw = (document.getElementById('newPassword') as HTMLInputElement).value;
      const confirmPw = (document.getElementById('confirmPassword') as HTMLInputElement).value;

      errorEl.classList.add('hidden');
      successEl.classList.add('hidden');

      if (newPw !== confirmPw) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.classList.remove('hidden');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Updating…';

      try {
        await updatePassword(newPw);
        successEl.textContent = 'Password updated! Redirecting…';
        successEl.classList.remove('hidden');
        setTimeout(() => this.#onReset(), 1500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update password';
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Update Password';
      }
    });
  }
}
