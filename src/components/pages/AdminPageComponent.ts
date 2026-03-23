import { Component } from '../base/Component';
import { getSupabaseClient } from '../../services/supabaseClient';
import type { CardType, CardRarity, CardSet } from '../../types';

interface AdminCard {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  mana_cost: number;
  attack: number;
  defense: number;
  description: string;
  art_gradient: string;
  set_name: CardSet;
  art_url: string | null;
}

const CARD_TYPES: CardType[] = ['Champion', 'Spell', 'Artifact'];
const CARD_RARITIES: CardRarity[] = ['Legendary', 'Epic', 'Rare', 'Common'];
const CARD_SETS: CardSet[] = ['Rift Core', 'Shattered Realms', 'Tidal Abyss', 'Void Expanse'];

export class AdminPageComponent extends Component {
  #cards: AdminCard[] = [];
  #editingId: string | null = null;
  #uploadingArt = false;

  render(): string {
    return `
      <div class="admin-page">
        <div class="admin-header">
          <div>
            <h1 class="admin-title">Card Admin</h1>
            <p class="admin-subtitle">Manage the Riftbound card database</p>
          </div>
          <a href="#/" class="admin-back">← Back to site</a>
        </div>

        <div class="admin-toolbar">
          <button class="admin-btn admin-btn--primary" id="addCardBtn">+ Add Card</button>
        </div>

        <!-- Add / Edit form -->
        <div id="adminForm" class="admin-form hidden">
          <h2 class="admin-form__title" id="formTitle">Add Card</h2>
          <div id="formError" class="auth-feedback auth-feedback--error hidden"></div>
          <div id="formSuccess" class="auth-feedback auth-feedback--success hidden"></div>

          <div class="admin-form__grid">
            <div class="form-group">
              <label for="fName">Name *</label>
              <input type="text" id="fName" required placeholder="Card name">
            </div>
            <div class="form-group">
              <label for="fType">Type *</label>
              <select id="fType">
                ${CARD_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="fRarity">Rarity *</label>
              <select id="fRarity">
                ${CARD_RARITIES.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="fSet">Set *</label>
              <select id="fSet">
                ${CARD_SETS.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="fMana">Mana Cost</label>
              <input type="number" id="fMana" min="0" max="20" value="3">
            </div>
            <div class="form-group">
              <label for="fAttack">Attack</label>
              <input type="number" id="fAttack" min="0" max="99" value="0">
            </div>
            <div class="form-group">
              <label for="fDefense">Defense</label>
              <input type="number" id="fDefense" min="0" max="99" value="0">
            </div>
            <div class="form-group">
              <label for="fGradient">Art Gradient (CSS)</label>
              <input type="text" id="fGradient" placeholder="linear-gradient(135deg, #1e3350 0%, #0a1628 100%)">
            </div>
            <div class="form-group form-group--full">
              <label for="fDesc">Description</label>
              <textarea id="fDesc" rows="3" placeholder="Card ability or flavor text"></textarea>
            </div>
            <div class="form-group form-group--full">
              <label>Card Art</label>
              <div class="art-upload">
                <input type="file" id="fArtFile" accept="image/jpeg,image/png,image/webp,image/gif">
                <span class="art-upload__label">Upload image (JPEG/PNG/WebP, max 5 MB)</span>
                <div id="uploadStatus" class="art-upload__status hidden"></div>
              </div>
              <input type="text" id="fArtUrl" placeholder="or paste public image URL directly" style="margin-top:8px">
              <div id="artPreviewWrap" class="art-preview hidden">
                <img id="artPreview" src="" alt="Art preview">
              </div>
            </div>
          </div>

          <div class="admin-form__actions">
            <button class="admin-btn admin-btn--primary" id="saveCardBtn">Save Card</button>
            <button class="admin-btn admin-btn--ghost" id="cancelFormBtn">Cancel</button>
          </div>
        </div>

        <!-- Cards table -->
        <div class="admin-table-wrap">
          <table class="admin-table" id="adminTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Rarity</th>
                <th>Set</th>
                <th>Art</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="adminTableBody">
              <tr><td colspan="6" class="admin-table__empty">Loading cards…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  afterMount(): void {
    document.getElementById('addCardBtn')?.addEventListener('click', () => this.#openForm(null));
    document.getElementById('cancelFormBtn')?.addEventListener('click', () => this.#closeForm());
    document.getElementById('saveCardBtn')?.addEventListener('click', () => this.#handleSave());

    document.getElementById('fArtFile')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await this.#handleImageUpload(file);
    });

    document.getElementById('fArtUrl')?.addEventListener('input', (e) => {
      const url = (e.target as HTMLInputElement).value.trim();
      this.#updateArtPreview(url);
    });

    this.#fetchCards();
  }

  async #fetchCards(): Promise<void> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('cards')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.#cards = (data as AdminCard[]) ?? [];
      this.#renderTable();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load cards';
      const tbody = document.getElementById('adminTableBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="admin-table__empty admin-table__empty--error">${msg}</td></tr>`;
    }
  }

  #renderTable(): void {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    if (this.#cards.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-table__empty">No cards yet. Add one above.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.#cards.map(card => `
      <tr data-id="${card.id}">
        <td class="admin-table__name">${card.name}</td>
        <td><span class="admin-badge admin-badge--type">${card.type}</span></td>
        <td><span class="admin-badge admin-badge--${card.rarity.toLowerCase()}">${card.rarity}</span></td>
        <td class="admin-table__set">${card.set_name}</td>
        <td>${card.art_url ? '<span class="admin-art-dot admin-art-dot--yes" title="Has image">✓</span>' : '<span class="admin-art-dot admin-art-dot--no">—</span>'}</td>
        <td class="admin-table__actions">
          <button class="admin-btn admin-btn--sm" data-action="edit" data-id="${card.id}">Edit</button>
          <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${card.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id!;
      if (btn.dataset.action === 'edit') this.#openForm(id);
      if (btn.dataset.action === 'delete') this.#handleDelete(id);
    }, { once: true });

    // Re-attach after each render
    tbody.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id!;
      if (btn.dataset.action === 'edit') this.#openForm(id);
      if (btn.dataset.action === 'delete') this.#handleDelete(id);
    });
  }

  #openForm(id: string | null): void {
    this.#editingId = id;
    const formEl = document.getElementById('adminForm')!;
    const titleEl = document.getElementById('formTitle')!;
    document.getElementById('formError')?.classList.add('hidden');
    document.getElementById('formSuccess')?.classList.add('hidden');

    if (id) {
      const card = this.#cards.find(c => c.id === id);
      if (!card) return;
      titleEl.textContent = 'Edit Card';
      (document.getElementById('fName') as HTMLInputElement).value = card.name;
      (document.getElementById('fType') as HTMLSelectElement).value = card.type;
      (document.getElementById('fRarity') as HTMLSelectElement).value = card.rarity;
      (document.getElementById('fSet') as HTMLSelectElement).value = card.set_name;
      (document.getElementById('fMana') as HTMLInputElement).value = String(card.mana_cost);
      (document.getElementById('fAttack') as HTMLInputElement).value = String(card.attack);
      (document.getElementById('fDefense') as HTMLInputElement).value = String(card.defense);
      (document.getElementById('fDesc') as HTMLTextAreaElement).value = card.description;
      (document.getElementById('fGradient') as HTMLInputElement).value = card.art_gradient;
      (document.getElementById('fArtUrl') as HTMLInputElement).value = card.art_url ?? '';
      this.#updateArtPreview(card.art_url ?? '');
    } else {
      titleEl.textContent = 'Add Card';
      (document.getElementById('fName') as HTMLInputElement).value = '';
      (document.getElementById('fType') as HTMLSelectElement).value = 'Champion';
      (document.getElementById('fRarity') as HTMLSelectElement).value = 'Common';
      (document.getElementById('fSet') as HTMLSelectElement).value = 'Rift Core';
      (document.getElementById('fMana') as HTMLInputElement).value = '3';
      (document.getElementById('fAttack') as HTMLInputElement).value = '0';
      (document.getElementById('fDefense') as HTMLInputElement).value = '0';
      (document.getElementById('fDesc') as HTMLTextAreaElement).value = '';
      (document.getElementById('fGradient') as HTMLInputElement).value = 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)';
      (document.getElementById('fArtUrl') as HTMLInputElement).value = '';
      (document.getElementById('fArtFile') as HTMLInputElement).value = '';
      this.#updateArtPreview('');
    }

    formEl.classList.remove('hidden');
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  #closeForm(): void {
    document.getElementById('adminForm')?.classList.add('hidden');
    this.#editingId = null;
  }

  async #handleSave(): Promise<void> {
    const errorEl = document.getElementById('formError')!;
    const successEl = document.getElementById('formSuccess')!;
    const saveBtn = document.getElementById('saveCardBtn') as HTMLButtonElement;

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const name = (document.getElementById('fName') as HTMLInputElement).value.trim();
    if (!name) {
      errorEl.textContent = 'Name is required.';
      errorEl.classList.remove('hidden');
      return;
    }

    const payload = {
      name,
      type: (document.getElementById('fType') as HTMLSelectElement).value as CardType,
      rarity: (document.getElementById('fRarity') as HTMLSelectElement).value as CardRarity,
      set_name: (document.getElementById('fSet') as HTMLSelectElement).value as CardSet,
      mana_cost: Number((document.getElementById('fMana') as HTMLInputElement).value) || 0,
      attack: Number((document.getElementById('fAttack') as HTMLInputElement).value) || 0,
      defense: Number((document.getElementById('fDefense') as HTMLInputElement).value) || 0,
      description: (document.getElementById('fDesc') as HTMLTextAreaElement).value.trim(),
      art_gradient: (document.getElementById('fGradient') as HTMLInputElement).value.trim() || 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)',
      art_url: (document.getElementById('fArtUrl') as HTMLInputElement).value.trim() || null,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      if (this.#editingId) {
        const { error } = await getSupabaseClient()
          .from('cards')
          .update(payload)
          .eq('id', this.#editingId);
        if (error) throw error;
      } else {
        const { error } = await getSupabaseClient()
          .from('cards')
          .insert([payload]);
        if (error) throw error;
      }

      successEl.textContent = this.#editingId ? 'Card updated.' : 'Card added.';
      successEl.classList.remove('hidden');
      this.#closeForm();
      await this.#fetchCards();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Card';
    }
  }

  async #handleDelete(id: string): Promise<void> {
    const card = this.#cards.find(c => c.id === id);
    if (!card) return;
    if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await getSupabaseClient()
        .from('cards')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await this.#fetchCards();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      alert(msg);
    }
  }

  async #handleImageUpload(file: File): Promise<void> {
    if (this.#uploadingArt) return;
    const statusEl = document.getElementById('uploadStatus')!;
    const artUrlInput = document.getElementById('fArtUrl') as HTMLInputElement;

    if (file.size > 5 * 1024 * 1024) {
      statusEl.textContent = 'File too large (max 5 MB).';
      statusEl.classList.remove('hidden');
      return;
    }

    this.#uploadingArt = true;
    statusEl.textContent = 'Uploading…';
    statusEl.classList.remove('hidden');

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await getSupabaseClient()
        .storage
        .from('card-art')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = getSupabaseClient()
        .storage
        .from('card-art')
        .getPublicUrl(path);

      artUrlInput.value = data.publicUrl;
      this.#updateArtPreview(data.publicUrl);
      statusEl.textContent = 'Upload complete.';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      statusEl.textContent = msg;
    } finally {
      this.#uploadingArt = false;
    }
  }

  #updateArtPreview(url: string): void {
    const wrap = document.getElementById('artPreviewWrap')!;
    const img = document.getElementById('artPreview') as HTMLImageElement;
    if (url) {
      img.src = url;
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  }
}
