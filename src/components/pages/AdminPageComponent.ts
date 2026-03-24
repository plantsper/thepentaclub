import { Component } from '../base/Component';
import { getSupabaseClient } from '../../services/supabaseClient';
import type { CardType } from '../../types';

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

interface OcrFields {
  name?:        string;
  type?:        CardType;
  description?: string;
  manaCost?:    number;
  attack?:      number;
  defense?:     number;
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
  mana_cost: number;
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
              <label for="fMana">Energy Cost</label>
              <input type="number" id="fMana" min="0" max="20" value="3">
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

        <!-- ── Cards table ────────────────────────────────────────────── -->
        <div class="admin-table-wrap">
          <table class="admin-table" id="adminTable">
            <thead>
              <tr>
                <th>Name</th><th>Type</th><th>Rarity</th><th>Set</th><th>Tags</th><th>Art</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="adminTableBody">
              <tr><td colspan="7" class="admin-table__empty">Loading…</td></tr>
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
        ${t.name}
        <button class="admin-lookup-chip__del" data-tag-id="${t.id}" title="Delete">×</button>
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
        ${s.name}
        <button class="admin-lookup-chip__del" data-set-id="${s.id}" title="Delete">×</button>
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
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="admin-table__empty admin-table__empty--error">${msg}</td></tr>`;
    }
  }

  #renderTable(): void {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    if (this.#cards.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-table__empty">No cards yet. Add one above.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.#cards.map(card => {
      const tagNames = card.card_tags?.map(ct => ct.tags.name).join(', ') || '—';
      return `
        <tr data-id="${card.id}">
          <td class="admin-table__name">${card.name}</td>
          <td><span class="admin-badge admin-badge--type">${card.type}</span></td>
          <td><span class="admin-badge admin-badge--${card.card_rarities?.name?.toLowerCase()}">${card.card_rarities?.name ?? '—'}</span></td>
          <td class="admin-table__set">${card.card_sets?.name ?? '—'}</td>
          <td class="admin-table__tags">${tagNames}</td>
          <td>${card.art_url ? '<span class="admin-art-dot--yes">✓</span>' : '<span class="admin-art-dot--no">—</span>'}</td>
          <td class="admin-table__actions">
            <button class="admin-btn admin-btn--sm" data-action="edit"   data-id="${card.id}">Edit</button>
            <button class="admin-btn admin-btn--sm admin-btn--danger" data-action="delete" data-id="${card.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id!;
      if (btn.dataset.action === 'edit')   this.#openForm(id);
      if (btn.dataset.action === 'delete') this.#handleDelete(id);
    });
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
      (document.getElementById('fMana')     as HTMLInputElement).value    = String(card.mana_cost);
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
      (document.getElementById('fMana')     as HTMLInputElement).value    = '3';
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
    const errorEl   = document.getElementById('formError')!;
    const successEl = document.getElementById('formSuccess')!;
    const saveBtn   = document.getElementById('saveCardBtn') as HTMLButtonElement;

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
      type:       (document.getElementById('fType')     as HTMLSelectElement).value as CardType,
      rarity_id:  Number((document.getElementById('fRarity')  as HTMLSelectElement).value),
      set_id:     Number((document.getElementById('fSet')     as HTMLSelectElement).value),
      mana_cost:  Number((document.getElementById('fMana')    as HTMLInputElement).value)   || 0,
      attack:     Number((document.getElementById('fAttack')  as HTMLInputElement).value)   || 0,
      defense:    Number((document.getElementById('fDefense') as HTMLInputElement).value)   || 0,
      description:(document.getElementById('fDesc')     as HTMLTextAreaElement).value.trim(),
      art_gradient:(document.getElementById('fGradient') as HTMLInputElement).value.trim()
                  || 'linear-gradient(135deg, #1e3350 0%, #0a1628 100%)',
      art_url:    (document.getElementById('fArtUrl')   as HTMLInputElement).value.trim() || null,
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
    const card = this.#cards.find(c => c.id === id);
    if (!card || !confirm(`Delete "${card.name}"? This cannot be undone.`)) return;
    const { error } = await getSupabaseClient().from('cards').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await this.#fetchCards();
  }

  async #handleImageUpload(file: File): Promise<void> {
    if (this.#uploadingArt) return;
    const statusEl   = document.getElementById('uploadStatus')!;
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
      const ext  = file.name.split('.').pop() ?? 'jpg';
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
      const { extractCardName } = await import('../../services/CardOcrService');
      const { name: ocrName, bannerName, setCode, collectorNum, cardNumber } = await extractCardName(file);

      const { lookupByCardCode, fuzzySearchCard, isIndexReady } = await import('../../services/RiftcodexService');

      // ── Priority 1: exact card-code lookup (guaranteed match) ─────────────
      let match = null;
      let method = '';

      if (setCode && collectorNum && isIndexReady()) {
        match = lookupByCardCode(setCode, collectorNum);
        if (match) method = 'card-code';
      }

      // ── Priority 2: also pre-fill the card code input for the user ────────
      if (setCode && collectorNum) {
        const codeInput = document.getElementById('cardCodeInput') as HTMLInputElement | null;
        if (codeInput && !codeInput.value) codeInput.value = `${setCode}-${collectorNum}`;
      }

      // ── Priority 3: fuzzy name search (fallback) ──────────────────────────
      if (!match && ocrName) {
        match = await fuzzySearchCard(ocrName, setCode);
        if (match) method = 'name';
      }
      if (!match && bannerName) {
        match = await fuzzySearchCard(bannerName, setCode);
        if (match) method = 'banner';
      }

      if (match) {
        this.#applyRiftcodexFields(match.fields);
        const numInfo  = cardNumber ? ` · ${cardNumber}` : '';
        const byCode   = method === 'card-code';
        const validated = byCode || match.fields.setValidated;
        const setLabel = setCode ? ` · ${setCode} ${validated ? '✓' : '⚠ unverified'}` : '';
        const methodLabel = byCode ? 'card code' : method === 'banner' ? 'banner name' : 'name';
        statusEl.className = `scan-status scan-status--${validated ? 'success' : 'warning'}`;
        statusEl.innerHTML =
          `<span class="scan-status__icon">${validated ? '✓' : '◈'}</span>` +
          `<span>Found: <strong>${match.fields.name}</strong>${setLabel}${numInfo}</span>` +
          `<span class="scan-status__badge">via ${methodLabel}</span>`;
      } else {
        // All lookups failed — fall back to raw OCR fields
        const { extractAllFields } = await import('../../services/CardOcrService');
        const ocr = await extractAllFields(file);
        this.#applyOcrFields(ocr);
        const tried = [ocrName, bannerName].filter(Boolean).map(n => `"${n}"`).join(', ');
        statusEl.className = 'scan-status scan-status--warning';
        statusEl.innerHTML =
          `<span class="scan-status__icon">◈</span>` +
          `<span>No match for ${tried || 'unknown'} — partial OCR fill. ` +
          `Enter the card code above for a guaranteed lookup.</span>`;
      }
    } catch (err) {
      statusEl.className = 'scan-status scan-status--error';
      statusEl.textContent = 'Scan failed — enter the card code (e.g. SFD-051) above for a guaranteed lookup.';
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
          `<span>Found: <strong>${match.fields.name}</strong> · ${setCode} ${collectorNum}</span>` +
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
          `<span>Found: <strong>${match.fields.name}</strong></span>` +
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
    if (fields.manaCost  != null) (document.getElementById('fMana')    as HTMLInputElement).value = String(fields.manaCost);
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

  #applyOcrFields(ocr: OcrFields): void {
    if (ocr.name)        (document.getElementById('fName')    as HTMLInputElement).value    = ocr.name;
    if (ocr.type)        (document.getElementById('fType')    as HTMLSelectElement).value   = ocr.type;
    if (ocr.description) (document.getElementById('fDesc')    as HTMLTextAreaElement).value = ocr.description;
    if (ocr.manaCost  != null) (document.getElementById('fMana')    as HTMLInputElement).value = String(ocr.manaCost);
    if (ocr.attack    != null) (document.getElementById('fAttack')  as HTMLInputElement).value = String(ocr.attack);
    if (ocr.defense   != null) (document.getElementById('fDefense') as HTMLInputElement).value = String(ocr.defense);
  }

  #updateArtPreview(url: string): void {
    const wrap = document.getElementById('artPreviewWrap')!;
    const img  = document.getElementById('artPreview') as HTMLImageElement;
    if (url) { img.src = url; wrap.classList.remove('hidden'); }
    else { wrap.classList.add('hidden'); }
  }
}
