import { Component } from '../base/Component';
import { getSupabaseClient } from '../../services/supabaseClient';
import { esc } from '../../utils/esc';
import { variantFromCardCode, variantLabel } from '../../utils/cardVariant';
import type { CardVariant } from '../../utils/cardVariant';
import { buildCardIndex, lookupByCardCode, fuzzySearchCard, isIndexReady } from '../../services/RiftcodexService';
import { warmIndexFromCatalog, lookupOrFetch } from '../../services/CatalogService';
import type { CatalogEntryInput } from '../../services/CatalogService';

// Minimal shape used by #applyRiftcodexFields — mirrors RiftcodexMatch['fields']
interface RiftcodexFields {
  name?:        string;
  type?:        string;
  rarityName?:  string;
  setName?:     string;
  attack?:      number;
  defense?:     number;
  description?: string;
  imageUrl?:    string;
  tags:         string[];
  energy?:      number;
  supertype?:   string;
  domains:      string[];
  flavour?:     string;
  artist?:      string;
}


interface RarityOption  { id: number; name: string; sort_order: number }
interface SetOption     { id: number; name: string; slug: string; description: string }
interface TagOption     { id: number; name: string }

interface AdminCard {
  id: string;
  rarity_id: number;
  set_id: number;
  price: number;
  art_gradient: string;
  art_url: string | null;
  card_set_code: string | null;
  card_code: string | null;
  catalog_id: string | null;
  card_rarities: { id: number; name: string };
  card_sets: { id: number; name: string };
  riftcodex_catalog: { name: string; type: string | null; image_url: string | null } | null;
}

export class AdminPageComponent extends Component {
  #cards: AdminCard[]       = [];
  #rarities: RarityOption[] = [];
  #sets: SetOption[]        = [];
  #allTags: TagOption[]     = [];
  #editingId: string | null = null;
  #uploadingArt             = false;
  #selectedIds: Set<string> = new Set();
  #bulkItems: { file: File; url: string }[] = [];

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
          <h3 class="admin-bulk-add__title">Bulk Import from Images</h3>
          <p class="admin-bulk-add__hint">Drop card photos below. Each image is OCR'd, matched in Riftcodex, and added automatically.</p>
          <div id="bulkDropZone" class="admin-bulk-drop">
            <input type="file" id="bulkFileInput" accept="image/jpeg,image/png,image/webp" multiple>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="admin-bulk-drop__label">Drop images here or <span class="admin-bulk-drop__browse">browse</span></span>
            <span class="admin-bulk-drop__hint">JPEG · PNG · WebP · max 5 MB each</span>
          </div>
          <div id="bulkQueue" class="admin-bulk-queue"></div>
          <div class="admin-form__actions">
            <button class="admin-btn admin-btn--primary" id="bulkAddImportBtn" disabled>Import Cards</button>
            <button class="admin-btn admin-btn--ghost"   id="bulkAddCancelBtn">Cancel</button>
          </div>
        </div>

        <!-- ── Add / Edit form ────────────────────────────────────────── -->
        <div id="adminForm" class="admin-form hidden">
          <h2 class="admin-form__title" id="formTitle">Add Card</h2>
          <div id="formError"   class="auth-feedback auth-feedback--error   hidden"></div>
          <div id="formSuccess" class="auth-feedback auth-feedback--success hidden"></div>

          <div class="admin-form__grid">
            <input type="hidden" id="fCatalogId">
            <div class="form-group">
              <label for="fName">Name <span style="font-size:11px;color:var(--text-muted)">(from Riftcodex)</span></label>
              <input type="text" id="fName" readonly placeholder="Auto-filled from scan / lookup">
            </div>
            <div class="form-group">
              <label for="fType">Type <span style="font-size:11px;color:var(--text-muted)">(from Riftcodex)</span></label>
              <input type="text" id="fType" readonly placeholder="Auto-filled from scan / lookup">
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
              <label for="fCardSetCode">Set Code</label>
              <input type="text" id="fCardSetCode" placeholder="e.g. SFD" maxlength="6" style="text-transform:uppercase">
            </div>
            <div class="form-group">
              <label for="fCardCode">Card Code</label>
              <input type="text" id="fCardCode" placeholder="e.g. 170/221 or 000a/100">
            </div>
            <div class="form-group">
              <label for="fPrice">Price ($)</label>
              <input type="number" id="fPrice" min="0" step="0.01" value="0.00">
            </div>
            <div class="form-group">
              <label for="fGradient">Art Gradient (CSS fallback)</label>
              <input type="text" id="fGradient" placeholder="linear-gradient(135deg, #1e3350 0%, #0a1628 100%)">
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
                <th>Name</th><th>Code</th><th>Type</th><th>Rarity</th><th>Set</th><th>Tags</th><th>Price</th><th>Art</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="adminTableBody">
              <tr><td colspan="10" class="admin-table__empty">Loading…</td></tr>
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
    document.getElementById('bulkAddBtn')?.addEventListener('click',       () => this.#toggleBulkAdd(true));
    document.getElementById('bulkAddCancelBtn')?.addEventListener('click', () => this.#toggleBulkAdd(false));
    document.getElementById('bulkAddImportBtn')?.addEventListener('click', () => void this.#handleBulkImport());

    // Drop zone
    const dropZone  = document.getElementById('bulkDropZone')!;
    const fileInput = document.getElementById('bulkFileInput') as HTMLInputElement;
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) this.#addBulkFiles([...fileInput.files]);
      fileInput.value = '';
    });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget as Node)) dropZone.classList.remove('dragging');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragging');
      const files = [...((e as DragEvent).dataTransfer?.files ?? [])];
      this.#addBulkFiles(files);
    });
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

    // Warm index from DB catalog first; fall back to full API fetch if catalog is empty
    warmIndexFromCatalog()
      .then(warmed => { if (!warmed) buildCardIndex().catch(() => {}); })
      .catch(() => buildCardIndex().catch(() => {}));

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
        .select(`id, price, art_gradient, art_url, card_set_code, card_code, catalog_id, rarity_id, set_id, card_rarities(id, name), card_sets(id, name), riftcodex_catalog(name, type, image_url)`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.#cards = (data as unknown as AdminCard[]) ?? [];
      this.#renderTable();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load cards';
      const tbody = document.getElementById('adminTableBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="admin-table__empty admin-table__empty--error">${esc(msg)}</td></tr>`;
    }
  }

  #renderTable(): void {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    this.#selectedIds.clear();
    this.#updateBulkToolbar();
    this.#hideBulkDeleteBanner();

    if (this.#cards.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="admin-table__empty">No cards yet. Add one above.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.#cards.map(card => {
      const cardName   = card.riftcodex_catalog?.name ?? '—';
      const cardType   = card.riftcodex_catalog?.type ?? '—';
      const rarityName = card.card_rarities?.name ?? '—';
      return `
        <tr data-id="${esc(card.id)}">
          <td class="admin-table__check"><input type="checkbox" class="row-select" data-id="${esc(card.id)}"></td>
          <td class="admin-table__name">${esc(cardName)}</td>
          <td class="admin-table__code">${(() => {
            if (!card.card_set_code || !card.card_code) return '—';
            const vLabel = variantLabel(variantFromCardCode(card.card_code));
            return `${esc(card.card_set_code)} ${esc(card.card_code)}${vLabel ? ` <span class="admin-badge admin-badge--variant">${esc(vLabel)}</span>` : ''}`;
          })()}</td>
          <td><span class="admin-badge admin-badge--type">${esc(cardType)}</span></td>
          <td><span class="admin-badge admin-badge--${esc(rarityName.toLowerCase())}">${esc(rarityName)}</span></td>
          <td class="admin-table__set">${esc(card.card_sets?.name ?? '—')}</td>
          <td class="admin-table__tags">—</td>
          <td class="admin-table__price">$${Number(card.price).toFixed(2)}</td>
          <td>${card.art_url ? '<span class="admin-art-dot--yes">✓</span>' : '<span class="admin-art-dot--no">—</span>'}</td>
          <td class="admin-table__actions">
            <button class="admin-btn admin-btn--sm" data-action="edit" data-id="${esc(card.id)}" aria-label="Edit ${esc(cardName)}">Edit</button>
            <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${esc(card.id)}" aria-label="Delete ${esc(cardName)}">Delete</button>
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

    if (id) {
      const card = this.#cards.find(c => c.id === id);
      if (!card) return;
      titleEl.textContent = 'Edit Card';
      (document.getElementById('fName')        as HTMLInputElement).value  = card.riftcodex_catalog?.name ?? '';
      (document.getElementById('fType')        as HTMLInputElement).value  = card.riftcodex_catalog?.type ?? '';
      (document.getElementById('fCatalogId')   as HTMLInputElement).value  = card.catalog_id ?? '';
      (document.getElementById('fRarity')      as HTMLSelectElement).value = String(card.rarity_id);
      (document.getElementById('fSet')         as HTMLSelectElement).value = String(card.set_id);
      (document.getElementById('fCardSetCode') as HTMLInputElement).value  = card.card_set_code ?? '';
      (document.getElementById('fCardCode')    as HTMLInputElement).value  = card.card_code ?? '';
      (document.getElementById('fPrice')       as HTMLInputElement).value  = Number(card.price).toFixed(2);
      (document.getElementById('fGradient')    as HTMLInputElement).value  = card.art_gradient;
      (document.getElementById('fArtUrl')      as HTMLInputElement).value  = card.art_url ?? '';
      this.#updateArtPreview(card.art_url ?? card.riftcodex_catalog?.image_url ?? '');
    } else {
      titleEl.textContent = 'Add Card';
      (document.getElementById('fName')        as HTMLInputElement).value  = '';
      (document.getElementById('fType')        as HTMLInputElement).value  = '';
      (document.getElementById('fCatalogId')   as HTMLInputElement).value  = '';
      (document.getElementById('fRarity')      as HTMLSelectElement).value = String(this.#rarities[0]?.id ?? '');
      (document.getElementById('fSet')         as HTMLSelectElement).value = String(this.#sets[0]?.id ?? '');
      (document.getElementById('fCardSetCode') as HTMLInputElement).value  = '';
      (document.getElementById('fCardCode')    as HTMLInputElement).value  = '';
      (document.getElementById('fPrice')       as HTMLInputElement).value  = '0.00';
      (document.getElementById('fGradient')    as HTMLInputElement).value  = 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)';
      (document.getElementById('fArtUrl')      as HTMLInputElement).value  = '';
      (document.getElementById('fArtFile')     as HTMLInputElement).value  = '';
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

    const catalogId = this.#el<HTMLInputElement>('fCatalogId').value.trim() || null;

    const payload = {
      rarity_id:     rarityId,
      set_id:        setId,
      catalog_id:    catalogId,
      card_set_code: this.#el<HTMLInputElement>('fCardSetCode').value.trim().toUpperCase() || null,
      card_code:     this.#el<HTMLInputElement>('fCardCode').value.trim() || null,
      price:         parseFloat(this.#el<HTMLInputElement>('fPrice').value) || 0,
      art_gradient:  this.#el<HTMLInputElement>('fGradient').value.trim()
                     || 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)',
      art_url:       this.#el<HTMLInputElement>('fArtUrl').value.trim() || null,
    };

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
    const cardName = card.riftcodex_catalog?.name ?? id;
    actionsCell.innerHTML = `
      <span class="admin-delete-confirm__label">Delete "${esc(cardName)}"?</span>
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
    const cardName = card.riftcodex_catalog?.name ?? id;
    actionsCell.innerHTML = `
      <button class="admin-btn admin-btn--sm" data-action="edit" data-id="${esc(id)}" aria-label="Edit ${esc(cardName)}">Edit</button>
      <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${esc(id)}" aria-label="Delete ${esc(cardName)}">Delete</button>
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
    document.getElementById('bulkAddSection')?.classList.toggle('hidden', !show);
    if (!show) {
      // Revoke all object URLs to free memory
      this.#bulkItems.forEach(item => URL.revokeObjectURL(item.url));
      this.#bulkItems = [];
      const queue = document.getElementById('bulkQueue');
      if (queue) queue.innerHTML = '';
      (document.getElementById('bulkAddImportBtn') as HTMLButtonElement).disabled = true;
    }
  }

  #addBulkFiles(files: File[]): void {
    const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const valid = files.filter(f => ALLOWED.has(f.type) && f.size <= 5 * 1024 * 1024);
    if (!valid.length) return;
    valid.forEach(file => this.#bulkItems.push({ file, url: URL.createObjectURL(file) }));
    this.#renderBulkQueue();
    (document.getElementById('bulkAddImportBtn') as HTMLButtonElement).disabled = false;
  }

  #renderBulkQueue(): void {
    const queue = document.getElementById('bulkQueue');
    if (!queue) return;

    if (!this.#bulkItems.length) { queue.innerHTML = ''; return; }

    queue.innerHTML = this.#bulkItems.map((item, i) => `
      <div class="bulk-queue-item" data-bulk-index="${i}">
        <img class="bulk-queue-item__thumb" src="${item.url}" alt="${esc(item.file.name)}">
        <div class="bulk-queue-item__info">
          <span class="bulk-queue-item__name">${esc(item.file.name.length > 28 ? item.file.name.slice(0, 25) + '…' : item.file.name)}</span>
          <span class="bulk-queue-item__status bulk-queue-status--pending">Pending</span>
        </div>
        <button class="bulk-queue-item__remove" data-bulk-remove="${i}" title="Remove">×</button>
      </div>
    `).join('');

    queue.querySelectorAll<HTMLElement>('[data-bulk-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.bulkRemove);
        URL.revokeObjectURL(this.#bulkItems[idx].url);
        this.#bulkItems.splice(idx, 1);
        this.#renderBulkQueue();
        (document.getElementById('bulkAddImportBtn') as HTMLButtonElement).disabled = !this.#bulkItems.length;
      });
    });
  }

  #setQueueItemStatus(index: number, state: 'scanning' | 'looking-up' | 'uploading' | 'added' | 'not-found' | 'error', text: string): void {
    const span = document.querySelector<HTMLElement>(`[data-bulk-index="${index}"] .bulk-queue-item__status`);
    if (!span) return;
    span.className = `bulk-queue-item__status bulk-queue-status--${state}`;
    span.textContent = text;
  }

  async #handleBulkImport(): Promise<void> {
    if (!this.#bulkItems.length) return;

    const importBtn = document.getElementById('bulkAddImportBtn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('bulkAddCancelBtn') as HTMLButtonElement;
    importBtn.disabled = true;
    cancelBtn.disabled = true;

    // Disable remove buttons while processing
    document.querySelectorAll<HTMLButtonElement>('.bulk-queue-item__remove').forEach(b => { b.disabled = true; });

    try {
      const { extractCardCode } = await import('../../services/CardOcrService');

      if (!isIndexReady()) {
        await buildCardIndex();
        if (!isIndexReady()) {
          // Mark all pending as error
          this.#bulkItems.forEach((_, i) => this.#setQueueItemStatus(i, 'error', 'Index load failed'));
          return;
        }
      }

      let added = 0;

      for (let i = 0; i < this.#bulkItems.length; i++) {
        const { file } = this.#bulkItems[i];

        // Step 1 — OCR
        this.#setQueueItemStatus(i, 'scanning', 'Scanning…');
        let setCode: string | undefined;
        let collectorNum: string | undefined;
        let cardNumber: string | undefined;
        try {
          const result = await extractCardCode(file);
          setCode      = result.setCode;
          collectorNum = result.collectorNum;
          cardNumber   = result.cardNumber;
        } catch {
          this.#setQueueItemStatus(i, 'error', 'Scan failed');
          continue;
        }

        if (!setCode || !collectorNum) {
          this.#setQueueItemStatus(i, 'not-found', 'Code not read');
          continue;
        }

        // Step 2 — Catalog-first lookup (DB → index → API) + upsert to catalog
        const numericCollector = parseInt(collectorNum.match(/\d+/)?.[0] ?? '0', 10);
        const cardVariant      = variantFromCardCode(cardNumber ?? collectorNum);
        this.#setQueueItemStatus(i, 'looking-up', `Looking up ${setCode}-${collectorNum}…`);
        const catalogResult = await lookupOrFetch(
          setCode, numericCollector, cardVariant,
          this.#makeCatalogFetchFn(cardVariant),
        );
        if (!catalogResult) {
          this.#setQueueItemStatus(i, 'not-found', `${setCode}-${numericCollector} not in Riftcodex`);
          continue;
        }

        const { catalogId, entry } = catalogResult;
        const matchedRarity = this.#rarities.find(r => r.name.toLowerCase() === entry.rarity_name?.toLowerCase());
        if (!matchedRarity && entry.rarity_name) console.warn(`[Bulk import] Unknown rarity "${entry.rarity_name}" — defaulting to first`);
        const rarityId = matchedRarity?.id ?? this.#rarities[0]?.id;
        const setId = this.#sets.find(s => {
          const sn = entry.set_name?.toLowerCase() ?? '';
          return sn.length > 0 && (s.name.toLowerCase().includes(sn) || sn.includes(s.name.toLowerCase()));
        })?.id ?? this.#sets[0]?.id;

        if (!rarityId || !setId) {
          this.#setQueueItemStatus(i, 'error', 'Could not resolve rarity/set');
          continue;
        }

        // Step 3 — Upload scan to storage (best-effort; non-fatal if it fails)
        this.#setQueueItemStatus(i, 'uploading', 'Uploading scan…');
        let userArtUrl: string | null = null;
        try { userArtUrl = await this.#uploadToStorage(file); } catch { /* non-fatal */ }

        // Step 4 — DB insert
        const { error } = await getSupabaseClient().from('cards').insert([{
          rarity_id:     rarityId,
          set_id:        setId,
          catalog_id:    catalogId,
          card_set_code: setCode,
          card_code:     cardNumber ?? collectorNum,
          price:         0,
          art_gradient:  'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)',
          art_url:       userArtUrl,
        }]);

        if (error) {
          this.#setQueueItemStatus(i, 'error', error.message);
        } else {
          this.#setQueueItemStatus(i, 'added', `Added: ${esc(entry.name)}`);
          added++;
        }
      }

      if (added > 0) await this.#fetchCards();

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.#bulkItems.forEach((_, i) => {
        const span = document.querySelector(`[data-bulk-index="${i}"] .bulk-queue-item__status`);
        if (span?.textContent === 'Pending') this.#setQueueItemStatus(i, 'error', msg);
      });
    } finally {
      importBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  async #uploadToStorage(file: File): Promise<string> {
    const ALLOWED_MIME: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png':  'png',
      'image/webp': 'webp',
    };
    const ext = ALLOWED_MIME[file.type];
    if (!ext) throw new Error('Unsupported file type (JPEG, PNG, or WebP only)');
    if (file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5 MB)');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await getSupabaseClient()
      .storage.from('card-art').upload(path, file, { upsert: false });
    if (error) throw error;
    return getSupabaseClient().storage.from('card-art').getPublicUrl(path).data.publicUrl;
  }

  async #handleImageUpload(file: File): Promise<void> {
    if (this.#uploadingArt) return;
    const statusEl   = document.getElementById('uploadStatus')!;
    const artUrlInput = document.getElementById('fArtUrl') as HTMLInputElement;

    this.#uploadingArt = true;
    statusEl.textContent = 'Uploading…';
    statusEl.classList.remove('hidden');

    try {
      const publicUrl = await this.#uploadToStorage(file);
      artUrlInput.value = publicUrl;
      this.#updateArtPreview(publicUrl);
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
      const { setCode, collectorNum, cardNumber, variant, rawResponse } = await extractCardCode(file);

      console.debug('[CardScan] Claude raw:', rawResponse, '→', { setCode, collectorNum, cardNumber, variant });

      // Pre-fill the card code input so the user can correct it if needed
      if (setCode && collectorNum) {
        const codeInput = document.getElementById('cardCodeInput') as HTMLInputElement | null;
        if (codeInput && !codeInput.value) codeInput.value = `${setCode}-${collectorNum}`;
        // Also pre-fill the stored card code fields
        const fCardSetCode = document.getElementById('fCardSetCode') as HTMLInputElement | null;
        if (fCardSetCode) fCardSetCode.value = setCode;
        const fCardCode = document.getElementById('fCardCode') as HTMLInputElement | null;
        if (fCardCode) fCardCode.value = cardNumber ?? collectorNum;
      }

      // ── Step 2: Catalog-first lookup (DB → index → API) ──────────────────
      if (setCode && collectorNum) {
        if (!isIndexReady()) {
          statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Fetching card index…';
          await buildCardIndex();
        }

        const numericCollector = parseInt(collectorNum.match(/\d+/)?.[0] ?? '0', 10);
        const cardVariant      = variantFromCardCode(cardNumber ?? collectorNum);
        const result = await lookupOrFetch(
          setCode, numericCollector, cardVariant,
          this.#makeCatalogFetchFn(cardVariant),
        );
        if (result) {
          const fields = this.#entryToFields(result.entry);
          this.#applyRiftcodexFields(fields, result.catalogId);
          statusEl.className = 'scan-status scan-status--success';
          statusEl.innerHTML =
            `<span class="scan-status__icon">✓</span>` +
            `<span>Found: <strong>${esc(fields.name ?? '')}</strong> · ${esc(setCode)} ${esc(collectorNum)}</span>` +
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

    // Accept formats: SFD-051  SFD-R01a  SFD–051  SFD•051  SFD 051
    const m = raw.match(/^([A-Z]{2,5})[^A-Z0-9]*([A-Z]?\d+[A-Z*]?)$/i);
    if (!m) {
      statusEl.className = 'scan-status scan-status--error';
      statusEl.textContent = `Invalid format — use "SFD-051" or "SFD-R01a" (set code + collector number).`;
      return;
    }
    const [, setCode, collectorNum] = m;

    statusEl.className = 'scan-status scan-status--loading';
    statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Looking up card…';

    try {
      if (!isIndexReady()) {
        statusEl.innerHTML = '<span class="scan-status__spinner"></span>&nbsp;Fetching card index…';
        await buildCardIndex();
      }

      const numericCollector = parseInt(collectorNum.match(/\d+/)?.[0] ?? '0', 10);
      const result = await lookupOrFetch(
        setCode, numericCollector, 'standard',
        this.#makeCatalogFetchFn('standard'),
      );
      if (result) {
        const fields = this.#entryToFields(result.entry);
        this.#applyRiftcodexFields(fields, result.catalogId);
        statusEl.className = 'scan-status scan-status--success';
        statusEl.innerHTML =
          `<span class="scan-status__icon">✓</span>` +
          `<span>Found: <strong>${esc(fields.name ?? '')}</strong> · ${esc(setCode)} ${esc(collectorNum)}</span>` +
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

  #applyRiftcodexFields(fields: RiftcodexFields, catalogId?: string): void {
    if (catalogId) (document.getElementById('fCatalogId') as HTMLInputElement).value = catalogId;
    if (fields.name) (document.getElementById('fName') as HTMLInputElement).value = fields.name;
    if (fields.type) (document.getElementById('fType') as HTMLInputElement).value = fields.type;

    // Match rarity by name (case-insensitive)
    if (fields.rarityName) {
      const rn = fields.rarityName.toLowerCase();
      const r  = this.#rarities.find(x => x.name.toLowerCase() === rn);
      if (r) (document.getElementById('fRarity') as HTMLSelectElement).value = String(r.id);
    }

    // Match set: accept partial overlap in either direction
    if (fields.setName) {
      const sn = fields.setName.toLowerCase();
      const s  = this.#sets.find(
        x => x.name.toLowerCase().includes(sn) || sn.includes(x.name.toLowerCase()),
      );
      if (s) (document.getElementById('fSet') as HTMLSelectElement).value = String(s.id);
    }

    // Show Riftcodex art as preview if no user upload is present yet
    if (fields.imageUrl) {
      const artUrl = (document.getElementById('fArtUrl') as HTMLInputElement).value.trim();
      if (!artUrl) this.#updateArtPreview(fields.imageUrl);
    }
  }

#updateArtPreview(url: string): void {
    const wrap = document.getElementById('artPreviewWrap')!;
    const img  = document.getElementById('artPreview') as HTMLImageElement;
    if (url) { img.src = url; wrap.classList.remove('hidden'); }
    else { wrap.classList.add('hidden'); }
  }

  // Convert a CatalogEntry to the RiftcodexFields shape used by #applyRiftcodexFields
  #entryToFields(entry: CatalogEntryInput): RiftcodexFields {
    return {
      name:        entry.name,
      type:        entry.type        ?? undefined,
      rarityName:  entry.rarity_name ?? undefined,
      setName:     entry.set_name    ?? undefined,
      attack:      entry.attack,
      defense:     entry.defense,
      description: entry.description,
      imageUrl:    entry.image_url   ?? undefined,
      tags:        [],
      energy:      entry.energy,
      supertype:   entry.supertype   ?? undefined,
      domains:     entry.domains,
      flavour:     entry.flavour     ?? undefined,
      artist:      entry.artist      ?? undefined,
    };
  }

  // Returns the fetchFn expected by lookupOrFetch — uses in-memory index or API
  #makeCatalogFetchFn(variant: CardVariant): (sc: string, cn: number) => Promise<{ entry: CatalogEntryInput; tags: string[] } | null> {
    return async (setCode, collectorNum) => {
      if (!isIndexReady()) await buildCardIndex();
      const match = lookupByCardCode(setCode, collectorNum);
      if (!match) return null;
      const fields = variant === 'signature'
        ? { ...match.fields, name: match.fields.name.replace(/\(Overnumbered\)$/i, '(Signature)') }
        : match.fields;
      return {
        entry: {
          set_code:      setCode,
          collector_num: collectorNum,
          variant,
          name:          fields.name          ?? '',
          type:          fields.type          ?? null,
          rarity_name:   fields.rarityName    ?? null,
          set_name:      fields.setName       ?? null,
          energy:        fields.energy        ?? 0,
          supertype:     fields.supertype     ?? null,
          attack:        fields.attack        ?? 0,
          defense:       fields.defense       ?? 0,
          description:   fields.description   ?? '',
          flavour:       fields.flavour       ?? null,
          artist:        fields.artist        ?? null,
          domains:       fields.domains       ?? [],
          image_url:     fields.imageUrl      ?? null,
        },
        tags: fields.tags ?? [],
      };
    };
  }
}
