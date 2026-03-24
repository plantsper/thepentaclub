import { Component } from '../base/Component';
import { getSupabaseClient } from '../../services/supabaseClient';
import type { CardType } from '../../types';
import { esc } from '../../utils/esc';

// Minimal shape used by #applyRiftcodexFields — mirrors RiftcodexMatch['fields']
interface RiftcodexFields {
  name?:        string;
  type?:        string;
  rarityName?:  string;
  setName?:     string;
  manaCost?:    number;
  attack?:      number;
  defense?:     number;
  description?: string;
  imageUrl?:    string;   // CDN URL from Riftcodex — skips manual art upload
  tags:         string[];
}


interface RarityOption  { id: number; name: string; sort_order: number }
interface SetOption     { id: number; name: string; slug: string; description: string }
interface TagOption     { id: number; name: string }

interface AdminCard {
  id: string;
  name: string;
  type: CardType;
  rarity_id: number;
  set_id: number;
  price: number;
  attack: number;
  defense: number;
  description: string;
  art_gradient: string;
  art_url: string | null;
  card_rarities: { id: number; name: string };
  card_sets: { id: number; name: string };
  card_tags: { tags: TagOption }[];
}

export class AdminPageComponent extends Component {
  #cards: AdminCard[]       = [];
  #rarities: RarityOption[] = [];
  #sets: SetOption[]        = [];
  #allTags: TagOption[]     = [];
  #editingId: string | null = null;
  #uploadingArt             = false;
  #selectedIds: Set<string> = new Set();

  // Typed getElementById that throws if the element is missing — safer than `!` casts.
  #el<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id) as T | null;
    if (!el) throw new Error(`[AdminPage] #${id} not found in DOM`);
    return el;
  }

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

        <!-- ── Lookup management ──────────────────────────────────────── -->
        <div class="admin-lookups">

          <div class="admin-lookup-section">
            <h3 class="admin-lookup-title">Sets</h3>
            <div id="setsManage" class="admin-lookup-list"></div>
            <form id="setForm" class="admin-lookup-form">
              <input type="text" id="setName"  placeholder="Name (e.g. Void Expanse)" required>
              <input type="text" id="setSlug"  placeholder="slug (e.g. void-expanse)" required>
              <input type="text" id="setDesc"  placeholder="Description (optional)">
              <button type="submit" class="admin-btn admin-btn--primary admin-btn--sm">Add Set</button>
            </form>
          </div>

          <div class="admin-lookup-section">
            <h3 class="admin-lookup-title">Tags</h3>
            <div id="tagsManage" class="admin-lookup-list"></div>
            <form id="tagForm" class="admin-lookup-form">
              <input type="text" id="newTagName" placeholder="New tag (e.g. AoE, Stealth)" required>
              <button type="submit" class="admin-btn admin-btn--primary admin-btn--sm">Add Tag</button>
            </form>
          </div>

        </div>

        <!-- ── Card toolbar ───────────────────────────────────────────── -->
        <div class="admin-toolbar">
          <button class="admin-btn admin-btn--primary" id="addCardBtn">+ Add Card</button>
          <button class="admin-btn admin-btn--ghost"   id="bulkAddBtn">Bulk Import</button>
          <button class="admin-btn admin-btn--danger hidden" id="bulkDeleteBtn">Delete selected (<span id="bulkDeleteCount">0</span>)</button>
        </div>

        <!-- ── Bulk import ─────────────────────────────────────────────── -->
        <div id="bulkAddSection" class="admin-bulk-add hidden">
          <h3 class="admin-bulk-add__title">Bulk Import from Riftcodex</h3>
          <p class="admin-bulk-add__hint">One card code per line (e.g. <code>SFD-051</code>). Cards are looked up in Riftcodex and added automatically.</p>
          <textarea id="bulkAddInput" class="admin-bulk-add__input" rows="6" placeholder="SFD-051&#10;VE-023&#10;TR-187"></textarea>
          <div id="bulkAddStatus" class="admin-bulk-add__status hidden"></div>
          <div class="admin-form__actions">
            <button class="admin-btn admin-btn--primary" id="bulkAddImportBtn">Import Cards</button>
            <button class="admin-btn admin-btn--ghost"   id="bulkAddCancelBtn">Cancel</button>
          </div>
        </div>

        <!-- ── Add / Edit form ────────────────────────────────────────── -->
        <div id="adminForm" class="admin-form hidden">
          <h2 class="admin-form__title" id="formTitle">Add Card</h2>
          <div id="formError"   class="auth-feedback auth-feedback--error   hidden"></div>
          <div id="formSuccess" class="auth-feedback auth-feedback--success hidden"></div>

          <div class="admin-form__grid">
            <div class="form-group">
              <label for="fName">Name *</label>
              <input type="text" id="fName" required placeholder="Card name">
            </div>
            <div class="form-group">
              <label for="fType">Type *</label>
              <select id="fType">
                <option value="Champion">Champion</option>
                <option value="Spell">Spell</option>
                <option value="Artifact">Artifact</option>
              </select>
            </div>
            <div class="form-group">
              <label for="fRarity">Rarity *</label>
              <select id="fRarity"></select>
            </div>
            <div class="form-group">
              <label for="fSet">Set *</label>
              <select id="fSet"></select>
            </div>
            <div class="form-group">
              <label for="fPrice">Price ($)</label>
              <input type="number" id="fPrice" min="0" step="0.01" value="0.00">
            </div>
            <div class="form-group">
              <label for="fAttack">Power</label>
              <input type="number" id="fAttack" min="0" max="99" value="0">
            </div>
            <div class="form-group">
              <label for="fDefense">Health</label>
              <input type="number" id="fDefense" min="0" max="99" value="0">
            </div>
            <div class="form-group">
              <label for="fGradient">Art Gradient (CSS fallback)</label>
              <input type="text" id="fGradient" placeholder="linear-gradient(135deg, #1e3350 0%, #0a1628 100%)">
            </div>
            <div class="form-group form-group--full">
              <label for="fDesc">Description</label>
              <textarea id="fDesc" rows="3" placeholder="Card ability or flavor text"></textarea>
            </div>
            <div class="form-group form-group--full">
              <label>Tags</label>
              <div id="tagsCheckboxes" class="tags-checkbox-list"></div>
            </div>
            <div class="form-group form-group--full">
              <label>Card Art</label>
              <div class="art-upload">
                <input type="file" id="fArtFile" accept="image/jpeg,image/png,image/webp,image/gif">
                <span class="art-upload__label">JPEG/PNG/WebP, max 5 MB — card fields auto-fill on upload</span>
                <div id="uploadStatus" class="art-upload__status hidden"></div>
              </div>
              <div id="scanStatus" class="scan-status hidden"></div>
              <div class="scan-manual">
                <input type="text" id="cardCodeInput" placeholder="Card code (e.g. SFD-051)" autocomplete="off">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" id="cardCodeBtn">Look up</button>
              </div>
              <div class="scan-manual" style="margin-top:4px">
                <input type="text" id="riftcodexSearch" placeholder="Or search by card name…" autocomplete="off">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" id="riftcodexSearchBtn">Search</button>
              </div>
              <input type="text" id="fArtUrl" placeholder="or paste public image URL" style="margin-top:8px">
              <div id="artPreviewWrap" class="art-preview hidden">
                <img id="artPreview" src="" alt="Art preview">
              </div>
            </div>
          </div>

          <div class="admin-form__actions">
            <button class="admin-btn admin-btn--primary" id="saveCardBtn">Save Card</button>
            <button class="admin-btn admin-btn--ghost"   id="cancelFormBtn">Cancel</button>
          </div>
        </div>

        <!-- ── Bulk delete confirmation banner ──────────────────────── -->
        <div id="bulkDeleteBanner" class="admin-bulk-banner hidden">
          <span>Delete <strong id="bulkDeleteBannerCount">0</strong> selected card(s)? This cannot be undone.</span>
          <span id="bulkDeleteError" class="admin-delete-error" style="display:none"></span>
          <div class="admin-bulk-banner__actions">
            <button class="admin-btn admin-btn--danger admin-btn--sm" id="bulkDeleteConfirmBtn">Yes, delete all</button>
            <button class="admin-btn admin-btn--ghost  admin-btn--sm" id="bulkDeleteCancelBtn">Cancel</button>
          </div>
        </div>

        <!-- ── Cards table ────────────────────────────────────────────── -->
        <div class="admin-table-wrap">
          <table class="admin-table" id="adminTable">
            <thead>
              <tr>
                <th class="admin-table__check"><input type="checkbox" id="selectAll" title="Select all"></th>
                <th>Name</th><th>Type</th><th>Rarity</th><th>Set</th><th>Tags</th><th>Price</th><th>Art</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="adminTableBody">
              <tr><td colspan="9" class="admin-table__empty">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  afterMount(): void {
    document.getElementById('addCardBtn')?.addEventListener('click',   () => this.#openForm(null));
    document.getElementById('cancelFormBtn')?.addEventListener('click', () => this.#closeForm());
    document.getElementById('saveCardBtn')?.addEventListener('click',   () => this.#handleSave());

    document.getElementById('fArtFile')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // Upload to Supabase Storage and OCR scan run in parallel
      await Promise.all([
        this.#handleImageUpload(file),
        this.#handleCardScan(file),
      ]);
    });

    document.getElementById('fArtUrl')?.addEventListener('input', (e) => {
      this.#updateArtPreview((e.target as HTMLInputElement).value.trim());
    });

    document.getElementById('cardCodeBtn')?.addEventListener('click', () => this.#handleCardCodeLookup());
    document.getElementById('cardCodeInput')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.#handleCardCodeLookup();
    });

    document.getElementById('riftcodexSearchBtn')?.addEventListener('click', () => this.#handleManualSearch());
    document.getElementById('riftcodexSearch')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.#handleManualSearch();
    });

    // Bulk import / delete
    document.getElementById('bulkAddBtn')?.addEventListener('click',        () => this.#toggleBulkAdd(true));
    document.getElementById('bulkAddCancelBtn')?.addEventListener('click',  () => this.#toggleBulkAdd(false));
    document.getElementById('bulkAddImportBtn')?.addEventListener('click',  () => void this.#handleBulkImport());
    document.getElementById('bulkDeleteBtn')?.addEventListener('click',     () => this.#showBulkDeleteBanner());
    document.getElementById('bulkDeleteConfirmBtn')?.addEventListener('click', () => void this.#executeBulkDelete());
    document.getElementById('bulkDeleteCancelBtn')?.addEventListener('click',  () => this.#hideBulkDeleteBanner());

    // Select-all checkbox
    document.getElementById('selectAll')?.addEventListener('change', (e) => {
      this.#selectAll((e.target as HTMLInputElement).checked);
    });

    // Table row actions (event delegation — persists across re-renders)
    document.getElementById('adminTableBody')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id!;
      if (btn.dataset.action === 'edit')           this.#openForm(id);
      if (btn.dataset.action === 'delete')         this.#promptDelete(id);
      if (btn.dataset.action === 'confirm-delete') void this.#handleDelete(id);
      if (btn.dataset.action === 'cancel-delete')  this.#cancelPromptDelete(id);
    });

    // Row checkboxes (event delegation)
    document.getElementById('adminTableBody')?.addEventListener('change', (e) => {
      const cb = e.target as HTMLInputElement;
      if (!cb.classList.contains('row-select')) return;
      if (cb.checked) this.#selectedIds.add(cb.dataset.id!);
      else            this.#selectedIds.delete(cb.dataset.id!);
      this.#updateBulkToolbar();
    });

    // Pre-fetch the Riftcodex card index in the background so lookups are instant when a card is uploaded
    import('../../services/RiftcodexService').then(({ buildCardIndex }) => buildCardIndex()).catch(() => {});

    document.getElementById('tagForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('newTagName') as HTMLInputElement;
      const name = input.value.trim();
      if (!name) return;
      const { error } = await getSupabaseClient().from('tags').insert([{ name }]);
      if (!error) { input.value = ''; await this.#fetchLookups(); }
    });

    document.getElementById('setForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('setName') as HTMLInputElement).value.trim();
      const slug = (document.getElementById('setSlug') as HTMLInputElement).value.trim();
      const desc = (document.getElementById('setDesc') as HTMLInputElement).value.trim();
      if (!name || !slug) return;
      const { error } = await getSupabaseClient().from('card_sets').insert([{ name, slug, description: desc }]);
      if (!error) {
        (document.getElementById('setName') as HTMLInputElement).value = '';
        (document.getElementById('setSlug') as HTMLInputElement).value = '';
        (document.getElementById('setDesc') as HTMLInputElement).value = '';
        await this.#fetchLookups();
      }
    });

    this.#initPage();
  }

  async #initPage(): Promise<void> {
    await this.#fetchLookups();
    await this.#fetchCards();
  }

  async #fetchLookups(): Promise<void> {
    const [{ data: rarities }, { data: sets }, { data: tags }] = await Promise.all([
      getSupabaseClient().from('card_rarities').select('id, name, sort_order').order('sort_order'),
      getSupabaseClient().from('card_sets').select('id, name, slug, description').order('name'),
      getSupabaseClient().from('tags').select('id, name').order('name'),
    ]);

    this.#rarities = (rarities as RarityOption[]) ?? [];
    this.#sets     = (sets as SetOption[])         ?? [];
    this.#allTags  = (tags as TagOption[])          ?? [];

    this.#populateSelects();
    this.#renderTagsManage();
    this.#renderSetsManage();
  }

  #populateSelects(): void {
    const rarityEl = document.getElementById('fRarity') as HTMLSelectElement | null;
    const setEl    = document.getElementById('fSet')    as HTMLSelectElement | null;
    if (rarityEl) rarityEl.innerHTML = this.#rarities.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    if (setEl)    setEl.innerHTML    = this.#sets.map(s    => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  #renderTagsManage(): void {
    const el = document.getElementById('tagsManage');
    if (!el) return;
    if (this.#allTags.length === 0) {
      el.innerHTML = '<span class="admin-lookup-empty">No tags yet.</span>';
      return;
    }
    el.innerHTML = this.#allTags.map(t => `
      <span class="admin-lookup-chip">
        ${esc(t.name)}
        <button class="admin-lookup-chip__del" data-tag-id="${t.id}" aria-label="Delete tag ${esc(t.name)}" title="Delete">×</button>
      </span>
    `).join('');

    el.querySelectorAll('[data-tag-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset.tagId);
        await getSupabaseClient().from('tags').delete().eq('id', id);
        await this.#fetchLookups();
        await this.#fetchCards();
      });
    });
  }

  #renderSetsManage(): void {
    const el = document.getElementById('setsManage');
    if (!el) return;
    if (this.#sets.length === 0) {
      el.innerHTML = '<span class="admin-lookup-empty">No sets yet.</span>';
      return;
    }
    el.innerHTML = this.#sets.map(s => `
      <span class="admin-lookup-chip">
        ${esc(s.name)}
        <button class="admin-lookup-chip__del" data-set-id="${s.id}" aria-label="Delete set ${esc(s.name)}" title="Delete">×</button>
      </span>
    `).join('');

    el.querySelectorAll('[data-set-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number((btn as HTMLElement).dataset.setId);
        const { error } = await getSupabaseClient().from('card_sets').delete().eq('id', id);
        if (error) { alert(error.message); return; }
        await this.#fetchLookups();
        await this.#fetchCards();
      });
    });
  }

  async #fetchCards(): Promise<void> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('cards')
        .select(`*, card_rarities(id, name), card_sets(id, name), card_tags(tags(id, name))`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.#cards = (data as AdminCard[]) ?? [];
      this.#renderTable();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load cards';
      const tbody = document.getElementById('adminTableBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="admin-table__empty admin-table__empty--error">${esc(msg)}</td></tr>`;
    }
  }

  #renderTable(): void {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    this.#selectedIds.clear();
    this.#updateBulkToolbar();
    this.#hideBulkDeleteBanner();

    if (this.#cards.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="admin-table__empty">No cards yet. Add one above.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.#cards.map(card => {
      const tagNames = card.card_tags?.map(ct => esc(ct.tags.name)).join(', ') || '—';
      const rarityName = card.card_rarities?.name ?? '—';
      return `
        <tr data-id="${esc(card.id)}">
          <td class="admin-table__check"><input type="checkbox" class="row-select" data-id="${esc(card.id)}"></td>
          <td class="admin-table__name">${esc(card.name)}</td>
          <td><span class="admin-badge admin-badge--type">${esc(card.type)}</span></td>
          <td><span class="admin-badge admin-badge--${esc(rarityName.toLowerCase())}">${esc(rarityName)}</span></td>
          <td class="admin-table__set">${esc(card.card_sets?.name ?? '—')}</td>
          <td class="admin-table__tags">${tagNames}</td>
          <td class="admin-table__price">$${Number(card.price).toFixed(2)}</td>
          <td>${card.art_url ? '<span class="admin-art-dot--yes">✓</span>' : '<span class="admin-art-dot--no">—</span>'}</td>
          <td class="admin-table__actions">
            <button class="admin-btn admin-btn--sm" data-action="edit" data-id="${esc(card.id)}" aria-label="Edit ${esc(card.name)}">Edit</button>
            <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${esc(card.id)}" aria-label="Delete ${esc(card.name)}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  #openForm(id: string | null): void {
    this.#editingId = id;
    const formEl  = document.getElementById('adminForm')!;
    const titleEl = document.getElementById('formTitle')!;
    document.getElementById('formError')?.classList.add('hidden');
    document.getElementById('formSuccess')?.classList.add('hidden');

    // Populate tag checkboxes
    const currentTagIds = id
      ? (this.#cards.find(c => c.id === id)?.card_tags ?? []).map(ct => ct.tags.id)
      : [];
    const tagsEl = document.getElementById('tagsCheckboxes')!;
    tagsEl.innerHTML = this.#allTags.length === 0
      ? '<span style="font-size:12px;color:var(--text-muted)">No tags yet — add them in the Tags section above.</span>'
      : this.#allTags.map(t => `
          <label class="tag-checkbox">
            <input type="checkbox" value="${t.id}" ${currentTagIds.includes(t.id) ? 'checked' : ''}>
            <span>${t.name}</span>
          </label>
        `).join('');

    if (id) {
      const card = this.#cards.find(c => c.id === id);
      if (!card) return;
      titleEl.textContent = 'Edit Card';
      (document.getElementById('fName')     as HTMLInputElement).value    = card.name;
      (document.getElementById('fType')     as HTMLSelectElement).value   = card.type;
      (document.getElementById('fRarity')   as HTMLSelectElement).value   = String(card.rarity_id);
      (document.getElementById('fSet')      as HTMLSelectElement).value   = String(card.set_id);
      (document.getElementById('fPrice')    as HTMLInputElement).value    = card.price.toFixed(2);
      (document.getElementById('fAttack')   as HTMLInputElement).value    = String(card.attack);
      (document.getElementById('fDefense')  as HTMLInputElement).value    = String(card.defense);
      (document.getElementById('fDesc')     as HTMLTextAreaElement).value = card.description;
      (document.getElementById('fGradient') as HTMLInputElement).value    = card.art_gradient;
      (document.getElementById('fArtUrl')   as HTMLInputElement).value    = card.art_url ?? '';
      this.#updateArtPreview(card.art_url ?? '');
    } else {
      titleEl.textContent = 'Add Card';
      (document.getElementById('fName')     as HTMLInputElement).value    = '';
      (document.getElementById('fType')     as HTMLSelectElement).value   = 'Champion';
      (document.getElementById('fRarity')   as HTMLSelectElement).value   = String(this.#rarities[0]?.id ?? '');
      (document.getElementById('fSet')      as HTMLSelectElement).value   = String(this.#sets[0]?.id ?? '');
      (document.getElementById('fPrice')    as HTMLInputElement).value    = '0.00';
      (document.getElementById('fAttack')   as HTMLInputElement).value    = '0';
      (document.getElementById('fDefense')  as HTMLInputElement).value    = '0';
      (document.getElementById('fDesc')     as HTMLTextAreaElement).value = '';
      (document.getElementById('fGradient') as HTMLInputElement).value    = 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)';
      (document.getElementById('fArtUrl')   as HTMLInputElement).value    = '';
      (document.getElementById('fArtFile')  as HTMLInputElement).value    = '';
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
    const errorEl   = this.#el('formError');
    const successEl = this.#el('formSuccess');
    const saveBtn   = this.#el<HTMLButtonElement>('saveCardBtn');

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const name = this.#el<HTMLInputElement>('fName').value.trim();
    if (!name) {
      errorEl.textContent = 'Name is required.';
      errorEl.classList.remove('hidden');
      return;
    }

    const rarityId = Number(this.#el<HTMLSelectElement>('fRarity').value);
    if (!rarityId) {
      errorEl.textContent = 'Please select a rarity.';
      errorEl.classList.remove('hidden');
      return;
    }

    const setId = Number(this.#el<HTMLSelectElement>('fSet').value);
    if (!setId) {
      errorEl.textContent = 'Please select a set.';
      errorEl.classList.remove('hidden');
      return;
    }

    const payload = {
      name,
      type:        this.#el<HTMLSelectElement>('fType').value as CardType,
      rarity_id:   rarityId,
      set_id:      setId,
      price:       parseFloat(this.#el<HTMLInputElement>('fPrice').value) || 0,
      attack:      Number(this.#el<HTMLInputElement>('fAttack').value)  || 0,
      defense:     Number(this.#el<HTMLInputElement>('fDefense').value) || 0,
      description: this.#el<HTMLTextAreaElement>('fDesc').value.trim(),
      art_gradient: this.#el<HTMLInputElement>('fGradient').value.trim()
                   || 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)',
      art_url:     this.#el<HTMLInputElement>('fArtUrl').value.trim() || null,
    };

    const selectedTagIds = Array.from(
      document.querySelectorAll<HTMLInputElement>('#tagsCheckboxes input[type="checkbox"]:checked')
    ).map(cb => Number(cb.value));

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      let cardId = this.#editingId;

      if (cardId) {
        const { error } = await getSupabaseClient().from('cards').update(payload).eq('id', cardId);
        if (error) throw error;
      } else {
        const { data, error } = await getSupabaseClient().from('cards').insert([payload]).select('id').single();
        if (error) throw error;
        cardId = (data as { id: string }).id;
      }

      // Sync tags: replace all
      await getSupabaseClient().from('card_tags').delete().eq('card_id', cardId);
      if (selectedTagIds.length > 0) {
        await getSupabaseClient().from('card_tags').insert(
          selectedTagIds.map(tagId => ({ card_id: cardId, tag_id: tagId }))
        );
      }

      successEl.textContent = this.#editingId ? 'Card updated.' : 'Card added.';
      successEl.classList.remove('hidden');
      this.#closeForm();
      await this.#fetchCards();
    } catch (err: unknown) {
      errorEl.textContent = err instanceof Error ? err.message : 'Save failed';
      errorEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Card';
    }
  }

  async #handleDelete(id: string): Promise<void> {
    const { error } = await getSupabaseClient().from('cards').delete().eq('id', id);
    if (error) {
      const row = document.querySelector<HTMLElement>(`tr[data-id="${id}"]`);
      const actionsCell = row?.querySelector<HTMLElement>('.admin-table__actions');
      if (actionsCell) {
        actionsCell.innerHTML = `
          <span class="admin-delete-error">${esc(error.message)}</span>
          <button class="admin-btn admin-btn--sm admin-btn--ghost" data-action="cancel-delete" data-id="${esc(id)}">OK</button>
        `;
      }
      return;
    }
    await this.#fetchCards();
  }

  // ── Inline delete confirmation ─────────────────────────────────────────────

  #promptDelete(id: string): void {
    const card = this.#cards.find(c => c.id === id);
    if (!card) return;
    const row = document.querySelector<HTMLElement>(`tr[data-id="${id}"]`);
    const actionsCell = row?.querySelector<HTMLElement>('.admin-table__actions');
    if (!actionsCell) return;
    actionsCell.innerHTML = `
      <span class="admin-delete-confirm__label">Delete "${esc(card.name)}"?</span>
      <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="confirm-delete" data-id="${esc(id)}">Yes</button>
      <button class="admin-btn admin-btn--sm admin-btn--ghost"  data-action="cancel-delete"  data-id="${esc(id)}">No</button>
    `;
  }

  #cancelPromptDelete(id: string): void {
    const card = this.#cards.find(c => c.id === id);
    if (!card) return;
    const row = document.querySelector<HTMLElement>(`tr[data-id="${id}"]`);
    const actionsCell = row?.querySelector<HTMLElement>('.admin-table__actions');
    if (!actionsCell) return;
    actionsCell.innerHTML = `
      <button class="admin-btn admin-btn--sm" data-action="edit" data-id="${esc(id)}" aria-label="Edit ${esc(card.name)}">Edit</button>
      <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${esc(id)}" aria-label="Delete ${esc(card.name)}">Delete</button>
    `;
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────

  #showBulkDeleteBanner(): void {
    const banner   = document.getElementById('bulkDeleteBanner');
    const countEl  = document.getElementById('bulkDeleteBannerCount');
    if (!banner || !countEl) return;
    countEl.textContent = String(this.#selectedIds.size);
    banner.classList.remove('hidden');
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  #hideBulkDeleteBanner(): void {
    document.getElementById('bulkDeleteBanner')?.classList.add('hidden');
  }

  async #executeBulkDelete(): Promise<void> {
    const ids = [...this.#selectedIds];
    if (ids.length === 0) return;

    const confirmBtn = document.getElementById('bulkDeleteConfirmBtn') as HTMLButtonElement | null;
    const cancelBtn  = document.getElementById('bulkDeleteCancelBtn')  as HTMLButtonElement | null;
    const errorSpan  = document.getElementById('bulkDeleteError')      as HTMLElement | null;

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Deleting…'; }
    if (cancelBtn)  cancelBtn.disabled = true;
    if (errorSpan)  errorSpan.style.display = 'none';

    const { error } = await getSupabaseClient().from('cards').delete().in('id', ids);

    if (error) {
      if (errorSpan) { errorSpan.textContent = error.message; errorSpan.style.display = ''; }
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Yes, delete all'; }
      if (cancelBtn)  cancelBtn.disabled = false;
      return;
    }

    this.#selectedIds.clear();
    this.#hideBulkDeleteBanner();
    await this.#fetchCards();
  }

  // ── Bulk toolbar helpers ───────────────────────────────────────────────────

  #updateBulkToolbar(): void {
    const count    = this.#selectedIds.size;
    const btn      = document.getElementById('bulkDeleteBtn');
    const countEl  = document.getElementById('bulkDeleteCount');
    const selectAll = document.getElementById('selectAll') as HTMLInputElement | null;
    if (btn)    btn.classList.toggle('hidden', count === 0);
    if (countEl) countEl.textContent = String(count);
    if (selectAll) {
      selectAll.checked       = count > 0 && count === this.#cards.length;
      selectAll.indeterminate = count > 0 && count < this.#cards.length;
    }
  }

  #selectAll(checked: boolean): void {
    this.#selectedIds.clear();
    if (checked) this.#cards.forEach(c => this.#selectedIds.add(c.id));
    document.querySelectorAll<HTMLInputElement>('.row-select').forEach(cb => { cb.checked = checked; });
    this.#updateBulkToolbar();
  }

  // ── Bulk import ────────────────────────────────────────────────────────────

  #toggleBulkAdd(show: boolean): void {
    const section = document.getElementById('bulkAddSection');
    section?.classList.toggle('hidden', !show);
    if (!show) {
      (document.getElementById('bulkAddInput')    as HTMLTextAreaElement).value = '';
      document.getElementById('bulkAddStatus')?.classList.add('hidden');
      (document.getElementById('bulkAddImportBtn') as HTMLButtonElement).disabled = false;
    }
  }

  async #handleBulkImport(): Promise<void> {
    const textarea  = document.getElementById('bulkAddInput')    as HTMLTextAreaElement;
    const statusEl  = document.getElementById('bulkAddStatus')!;
    const importBtn = document.getElementById('bulkAddImportBtn') as HTMLButtonElement;

    // Parse and validate all codes up-front so the progress counter is accurate
    const rawLines = textarea.value.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean);
    if (rawLines.length === 0) return;

    const parsedCodes: { setCode: string; collectorNum: string; raw: string }[] = [];
    const invalidLines: string[] = [];
    for (const line of rawLines) {
      const m = line.match(/^([A-Z]{2,5})[^A-Z0-9]*(\d+)$/);
      if (m) parsedCodes.push({ setCode: m[1], collectorNum: m[2], raw: line });
      else   invalidLines.push(line);
    }

    importBtn.disabled = true;
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Building card index…';

    try {
      const { buildCardIndex, isIndexReady, lookupByCardCode } =
        await import('../../services/RiftcodexService');

      if (!isIndexReady()) {
        await buildCardIndex();
        // Verify the index actually loaded — a network failure leaves it empty
        if (!isIndexReady()) {
          statusEl.textContent = 'Failed to load Riftcodex card index. Check your connection and try again.';
          return;
        }
      }

      let added = 0;
      const notFound: string[]  = [];
      const dbErrors:  string[] = [];

      for (let i = 0; i < parsedCodes.length; i++) {
        const { setCode, collectorNum, raw } = parsedCodes[i];
        statusEl.textContent = `Looking up ${i + 1} / ${parsedCodes.length}: ${raw}…`;

        const match = lookupByCardCode(setCode, collectorNum);
        if (!match) { notFound.push(raw); continue; }

        const f = match.fields;

        // Resolve rarity — exact name match, falls back to first rarity if unknown
        const rarityId = this.#rarities.find(
          r => r.name.toLowerCase() === f.rarityName?.toLowerCase(),
        )?.id ?? this.#rarities[0]?.id;

        // Resolve set — partial name match in either direction, falls back to first set
        const setId = this.#sets.find(s => {
          const sn = f.setName?.toLowerCase() ?? '';
          return sn.length > 0 && (s.name.toLowerCase().includes(sn) || sn.includes(s.name.toLowerCase()));
        })?.id ?? this.#sets[0]?.id;

        if (!rarityId || !setId) {
          dbErrors.push(`${raw} (could not resolve rarity/set)`);
          continue;
        }

        const { error } = await getSupabaseClient().from('cards').insert([{
          name:         f.name,
          type:         (f.type ?? 'Spell') as CardType,
          rarity_id:    rarityId,
          set_id:       setId,
          price:        0,
          attack:       f.attack      ?? 0,
          defense:      f.defense     ?? 0,
          description:  f.description ?? '',
          art_gradient: 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)',
          art_url:      f.imageUrl    ?? null,
        }]);

        if (error) { dbErrors.push(`${raw} (${error.message})`); }
        else        { added++; }
      }

      // Build summary
      const lines: string[] = [`${added} of ${parsedCodes.length} cards added.`];
      if (invalidLines.length) lines.push(`${invalidLines.length} skipped — bad format: ${invalidLines.join(', ')}`);
      if (notFound.length)     lines.push(`${notFound.length} not in Riftcodex: ${notFound.join(', ')}`);
      if (dbErrors.length)     lines.push(`${dbErrors.length} DB errors: ${dbErrors.join('; ')}`);
      statusEl.textContent = lines.join(' | ');

      if (added > 0) await this.#fetchCards();

    } catch (err) {
      statusEl.textContent = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      importBtn.disabled = false;
    }
  }

  async #handleImageUpload(file: File): Promise<void> {
    if (this.#uploadingArt) return;
    const statusEl   = document.getElementById('uploadStatus')!;
    const artUrlInput = document.getElementById('fArtUrl') as HTMLInputElement;

    const ALLOWED_MIME: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png':  'png',
      'image/webp': 'webp',
    };
    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      statusEl.textContent = 'Unsupported file type (JPEG, PNG, or WebP only).';
      statusEl.classList.remove('hidden');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      statusEl.textContent = 'File too large (max 5 MB).';
      statusEl.classList.remove('hidden');
      return;
    }

    this.#uploadingArt = true;
    statusEl.textContent = 'Uploading…';
    statusEl.classList.remove('hidden');

    try {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await getSupabaseClient()
        .storage.from('card-art').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = getSupabaseClient().storage.from('card-art').getPublicUrl(path);
      artUrlInput.value = data.publicUrl;
      this.#updateArtPreview(data.publicUrl);
      statusEl.textContent = 'Upload complete.';
    } catch (err: unknown) {
      statusEl.textContent = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      this.#uploadingArt = false;
    }
  }

  // ── Card scan pipeline ────────────────────────────────────────────────────

  async #handleCardScan(file: File): Promise<void> {
    const statusEl = document.getElementById('scanStatus')!;
    statusEl.className = 'scan-status scan-status--loading';
    statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Reading card…';

    try {
      // ── Step 1: Claude vision extracts the card code ───────────────────────
      const { extractCardCode } = await import('../../services/CardOcrService');
      const { setCode, collectorNum, cardNumber, rawResponse } = await extractCardCode(file);

      console.debug('[CardScan] Claude raw:', rawResponse, '→', { setCode, collectorNum, cardNumber });

      // Pre-fill the card code input so the user can correct it if needed
      if (setCode && collectorNum) {
        const codeInput = document.getElementById('cardCodeInput') as HTMLInputElement | null;
        if (codeInput && !codeInput.value) codeInput.value = `${setCode}-${collectorNum}`;
      }

      const { lookupByCardCode, buildCardIndex, isIndexReady } = await import('../../services/RiftcodexService');

      // ── Step 2: Guaranteed card-code lookup from pre-fetched index ─────────
      if (setCode && collectorNum) {
        if (!isIndexReady()) {
          statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Fetching card index…';
          await buildCardIndex();
        }

        const match = lookupByCardCode(setCode, collectorNum);
        if (match) {
          this.#applyRiftcodexFields(match.fields);
          statusEl.className = 'scan-status scan-status--success';
          statusEl.innerHTML =
            `<span class="scan-status__icon">✓</span>` +
            `<span>Found: <strong>${esc(match.fields.name)}</strong> · ${esc(setCode)} ${esc(collectorNum)}</span>` +
            `<span class="scan-status__badge">card code</span>`;
          return;
        }
      }

      // ── Step 3: Card code not found in index ───────────────────────────────
      if (setCode || cardNumber) {
        statusEl.className = 'scan-status scan-status--warning';
        statusEl.innerHTML =
          `<span class="scan-status__icon">◈</span>` +
          `<span>Read code <strong>${esc(cardNumber ?? `${setCode}-${collectorNum}`)}</strong> but not found in Riftcodex. ` +
          `Verify the code above and hit "Look up".</span>`;
      } else {
        statusEl.className = 'scan-status scan-status--warning';
        statusEl.innerHTML =
          `<span class="scan-status__icon">◈</span>` +
          `<span>Could not read card code — enter it manually above (e.g. SFD-170).</span>`;
      }
    } catch (err) {
      statusEl.className = 'scan-status scan-status--error';
      statusEl.innerHTML =
        `<span class="scan-status__icon">✕</span>` +
        `<span>Scan failed — enter the card code above (e.g. SFD-170).</span>`;
      console.error('[CardScan]', err);
    }
  }

  async #handleCardCodeLookup(): Promise<void> {
    const input    = document.getElementById('cardCodeInput') as HTMLInputElement;
    const statusEl = document.getElementById('scanStatus')!;
    const raw      = input.value.trim().toUpperCase();
    if (!raw) return;

    // Accept formats: SFD-051  SFD–051  SFD•051  SFD 051
    const m = raw.match(/^([A-Z]{2,5})[^A-Z0-9]*(\d+)$/);
    if (!m) {
      statusEl.className = 'scan-status scan-status--error';
      statusEl.textContent = `Invalid format — use "SFD-051" (set code + collector number).`;
      return;
    }
    const [, setCode, collectorNum] = m;

    statusEl.className = 'scan-status scan-status--loading';
    statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Looking up card…';

    try {
      const { lookupByCardCode, buildCardIndex, isIndexReady } = await import('../../services/RiftcodexService');

      if (!isIndexReady()) {
        statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Fetching card index…';
        await buildCardIndex();
      }

      const match = lookupByCardCode(setCode, collectorNum);
      if (match) {
        this.#applyRiftcodexFields(match.fields);
        statusEl.className = 'scan-status scan-status--success';
        statusEl.innerHTML =
          `<span class="scan-status__icon">✓</span>` +
          `<span>Found: <strong>${esc(match.fields.name)}</strong> · ${esc(setCode)} ${esc(collectorNum)}</span>` +
          `<span class="scan-status__badge">card code</span>`;
      } else {
        statusEl.className = 'scan-status scan-status--error';
        statusEl.textContent = `No card found for ${setCode}-${collectorNum} — check the code and try again.`;
      }
    } catch {
      statusEl.className = 'scan-status scan-status--error';
      statusEl.textContent = 'Lookup failed — check your connection.';
    }
  }

  async #handleManualSearch(): Promise<void> {
    const input    = document.getElementById('riftcodexSearch') as HTMLInputElement;
    const statusEl = document.getElementById('scanStatus')!;
    const query    = input.value.trim();
    if (!query) return;

    statusEl.className = 'scan-status scan-status--loading';
    statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Searching Riftcodex…';

    try {
      const { fuzzySearchCard } = await import('../../services/RiftcodexService');
      const match = await fuzzySearchCard(query);

      if (match) {
        this.#applyRiftcodexFields(match.fields);
        statusEl.className = 'scan-status scan-status--success';
        statusEl.innerHTML =
          `<span class="scan-status__icon">✓</span>` +
          `<span>Found: <strong>${esc(match.fields.name)}</strong></span>` +
          `<span class="scan-status__badge">manual search</span>`;
      } else {
        statusEl.className = 'scan-status scan-status--error';
        statusEl.textContent = `No Riftcodex result for "${query}" — fill fields manually.`;
      }
    } catch {
      statusEl.className = 'scan-status scan-status--error';
      statusEl.textContent = 'Search failed — check your connection.';
    }
  }

  #applyRiftcodexFields(fields: RiftcodexFields): void {
    if (fields.name)        (document.getElementById('fName')    as HTMLInputElement).value    = fields.name;
    if (fields.type)        (document.getElementById('fType')    as HTMLSelectElement).value   = fields.type;
    if (fields.description) (document.getElementById('fDesc')    as HTMLTextAreaElement).value = fields.description;
    // Price is not sourced from Riftcodex — admin must set it manually
    if (fields.attack    != null) (document.getElementById('fAttack')  as HTMLInputElement).value = String(fields.attack);
    if (fields.defense   != null) (document.getElementById('fDefense') as HTMLInputElement).value = String(fields.defense);

    // Match rarity by name (case-insensitive)
    if (fields.rarityName) {
      const rn = fields.rarityName.toLowerCase();
      const r  = this.#rarities.find(x => x.name.toLowerCase() === rn);
      if (r) (document.getElementById('fRarity') as HTMLSelectElement).value = String(r.id);
    }

    // Match set: accept partial overlap in either direction
    if (fields.setName) {
      const sn  = fields.setName.toLowerCase();
      const s   = this.#sets.find(
        x => x.name.toLowerCase().includes(sn) || sn.includes(x.name.toLowerCase()),
      );
      if (s) (document.getElementById('fSet') as HTMLSelectElement).value = String(s.id);
    }

    // Auto-fill art URL from Riftcodex CDN (skips manual upload for official cards)
    if (fields.imageUrl) {
      (document.getElementById('fArtUrl') as HTMLInputElement).value = fields.imageUrl;
      this.#updateArtPreview(fields.imageUrl);
    }

    // Check tag checkboxes whose label text matches any returned tag name
    if (fields.tags.length > 0) {
      const apiTagsLower = fields.tags.map(t => t.toLowerCase());
      document.querySelectorAll<HTMLInputElement>('#tagsCheckboxes input[type="checkbox"]').forEach(cb => {
        const label = cb.closest('label')?.querySelector('span')?.textContent?.toLowerCase() ?? '';
        cb.checked  = apiTagsLower.some(t => label.includes(t) || t.includes(label));
      });
    }
  }

#updateArtPreview(url: string): void {
    const wrap = document.getElementById('artPreviewWrap')!;
    const img  = document.getElementById('artPreview') as HTMLImageElement;
    if (url) { img.src = url; wrap.classList.remove('hidden'); }
    else { wrap.classList.add('hidden'); }
  }
}
