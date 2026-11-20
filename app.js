(() => {
  'use strict';

  const STORAGE_KEY = 'little-blue-closet:v1';
  const categories = ['全部', '上装', '下装', '套装', '外套', '鞋子', '包包', '配饰'];
  const itemCategories = categories.slice(1);
  const seasons = ['春季', '夏季', '秋季', '冬季', '四季'];
  const outfitCategories = ['日常', '工作', '旅游'];
  const categoryEmoji = { 上装: '👚', 下装: '👖', 套装: '👗', 外套: '🧥', 鞋子: '👟', 包包: '👜', 配饰: '🧢' };
  const sampleItems = [
    { name: '雾霾蓝针织衫', category: '上装', season: '春季', brand: 'cotton days', price: 269, rating: 5, keywords: '柔软,通勤,蓝色', wears: 12, tint: '#dce8f6', emoji: '👚' },
    { name: '奶油白直筒裤', category: '下装', season: '四季', brand: 'simple note', price: 329, rating: 5, keywords: '百搭,通勤,白色', wears: 18, tint: '#f0ebdd', emoji: '👖' },
    { name: '小香风短外套', category: '外套', season: '秋季', brand: 'mori studio', price: 539, rating: 4, keywords: '复古,约会', wears: 7, tint: '#e8dfe4', emoji: '🧥' },
    { name: '轻盈芭蕾平底鞋', category: '鞋子', season: '春季', brand: 'soft steps', price: 399, rating: 5, keywords: '舒服,约会,粉色', wears: 10, tint: '#f4e4e6', emoji: '👟' },
    { name: '周末帆布托特包', category: '包包', season: '夏季', brand: 'little muse', price: 159, rating: 4, keywords: '日常,轻便', wears: 5, tint: '#dfe9df', emoji: '👜' }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function loadState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (state && Array.isArray(state.items) && Array.isArray(state.outfits)) return state;
    } catch (error) {
      console.error('读取本地衣橱数据失败。', error);
    }

    return {
      items: sampleItems.map((item) => ({
        ...item,
        id: makeId(),
        image: '',
        createdAt: Date.now() - Math.floor(Math.random() * 1000000000),
        relatedOutfits: []
      })),
      outfits: []
    };
  }

  let state = loadState();
  let activeCategory = '全部';
  let activeView = 'wardrobe';
  let sortNewest = true;
  let pendingPhoto = '';
  let pendingPhotoCutout = false;
  let selectedPieceIds = [];
  let extraPieces = [];
  let selectedBackground = 'blue';
  let pieceLayouts = {};
  let activePieceId = '';
  const pieceGestures = new Map();
  let toastTimer;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('保存本地衣橱数据失败。', error);
      showToast('本机储存空间不足，请删除一些图片后重试');
      return false;
    }
  }

  function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function formatPrice(value) {
    const amount = Number(value) || 0;
    return `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(amount)}`;
  }

  function imageMarkup(item, extraClass = '') {
    if (item.image) return `<img class="${item.cutout ? 'is-cutout ' : ''}${extraClass}" src="${item.image}" alt="${escapeHtml(item.name)}">`;
    return `<span class="item-emoji" aria-hidden="true">${escapeHtml(item.emoji || categoryEmoji[item.category] || '✿')}</span>`;
  }

  function renderCategories() {
    byId('wardrobe-categories').innerHTML = categories.map((category) => `
      <button class="category-chip ${category === activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
    `).join('');
  }

  function getFilteredItems() {
    const query = byId('wardrobe-search').value.trim().toLocaleLowerCase();
    return state.items.filter((item) => {
      const matchCategory = activeCategory === '全部' || item.category === activeCategory;
      const searchable = `${item.name} ${item.category} ${item.brand} ${item.season} ${item.keywords}`.toLocaleLowerCase();
      return matchCategory && searchable.includes(query);
    }).sort((a, b) => sortNewest ? b.createdAt - a.createdAt : a.name.localeCompare(b.name, 'zh-CN'));
  }

  function renderWardrobe() {
    renderCategories();
    byId('item-count').textContent = String(state.items.length);
    const items = getFilteredItems();
    byId('closet-summary').textContent = items.length
      ? `正在展示 ${items.length} 件单品 · 共 ${state.items.reduce((sum, item) => sum + (Number(item.wears) || 0), 0)} 次穿着记录`
      : '还没有找到单品，换个关键词试试吧。';
    byId('wardrobe-grid').innerHTML = items.length ? items.map((item) => `
      <button class="item-card" data-edit-item="${escapeHtml(item.id)}" aria-label="编辑${escapeHtml(item.name)}">
        <div class="item-art" style="background:${escapeHtml(item.tint || '#f2f5fa')}">
          ${imageMarkup(item)}
          <span class="item-kind">${escapeHtml(item.category)}</span>
          <span class="item-heart">${'★'.repeat(Math.max(0, Math.min(5, Number(item.rating) || 0)))}</span>
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <div class="item-details"><span>${escapeHtml(item.brand || item.season || '心爱单品')}</span><span>${Number(item.wears) || 0} 次</span></div>
      </button>
    `).join('') : `
      <div class="empty-state"><span class="empty-state-icon">♡</span><strong>${state.items.length ? '没有找到这件单品' : '衣橱正在等你来填满'}</strong><p>${state.items.length ? '换个分类或关键词试试看。' : '拍照或从相册添加喜欢的衣服吧。'}</p><button class="button button-primary" data-action="import">添加一件衣服</button></div>
    `;
  }

  function renderPicker() {
    const picker = byId('picker-grid');
    picker.innerHTML = state.items.length ? state.items.map((item) => `
      <button class="picker-card ${selectedPieceIds.includes(item.id) ? 'selected' : ''}" data-pick-item="${escapeHtml(item.id)}" aria-pressed="${selectedPieceIds.includes(item.id)}">
        <span class="picker-art">${imageMarkup(item)}${selectedPieceIds.includes(item.id) ? '<span class="picker-check">✓</span>' : ''}</span>
        <span class="picker-name">${escapeHtml(item.name)}</span><span class="picker-category">${escapeHtml(item.category)}</span>
      </button>
    `).join('') : '<div class="empty-state"><span class="empty-state-icon">✿</span><strong>还没有可以搭配的衣物</strong><p>先去衣橱添加几件心爱的单品。</p><button class="button button-outline" data-nav="wardrobe">逛逛衣橱</button></div>';
    updateCollage();
  }

  function getSelectedPieces() {
    return [
      ...selectedPieceIds.map((id) => state.items.find((item) => item.id === id)).filter(Boolean),
      ...extraPieces
    ];
  }

  function getPieceLayout(piece, index) {
    if (!pieceLayouts[piece.id]) {
      const defaults = [
        { x: 26, y: 31, rotation: -8 },
        { x: 74, y: 31, rotation: 7 },
        { x: 72, y: 70, rotation: -6 },
        { x: 28, y: 70, rotation: 5 },
        { x: 50, y: 51, rotation: 2 }
      ];
      const position = defaults[index] || {
        x: 18 + ((index * 29) % 64),
        y: 21 + ((index * 37) % 61),
        rotation: (index % 2 ? 1 : -1) * (4 + index % 7)
      };
      pieceLayouts[piece.id] = { ...position, scale: 1 };
    }
    return pieceLayouts[piece.id];
  }

  function applyPieceLayout(element, layout) {
    element.style.left = `${layout.x}%`;
    element.style.top = `${layout.y}%`;
    element.style.transform = `translate(-50%, -50%) rotate(${layout.rotation}deg) scale(${layout.scale})`;
  }

  function attachPieceGestures(element, piece) {
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      element.classList.add('is-active');
      element.style.zIndex = '10';
      activePieceId = piece.id;
      updateActivePieceControls();
      const gesture = pieceGestures.get(piece.id) || { pointers: new Map() };
      gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gesture.pointers.size === 1) {
        gesture.mode = 'drag';
        gesture.startPointer = { x: event.clientX, y: event.clientY };
        gesture.startLayout = { ...getPieceLayout(piece, getSelectedPieces().indexOf(piece)) };
      } else if (gesture.pointers.size === 2) {
        const [first, second] = [...gesture.pointers.values()];
        gesture.mode = 'pinch';
        gesture.startDistance = Math.hypot(first.x - second.x, first.y - second.y);
        gesture.startScale = getPieceLayout(piece, getSelectedPieces().indexOf(piece)).scale;
      }
      pieceGestures.set(piece.id, gesture);
    });

    element.addEventListener('pointermove', (event) => {
      const gesture = pieceGestures.get(piece.id);
      if (!gesture?.pointers.has(event.pointerId)) return;
      gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const layout = getPieceLayout(piece, getSelectedPieces().indexOf(piece));
      const bounds = byId('collage-pieces').getBoundingClientRect();
      if (gesture.mode === 'pinch' && gesture.pointers.size >= 2 && gesture.startDistance > 0) {
        const [first, second] = [...gesture.pointers.values()];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        layout.scale = Math.min(2.4, Math.max(0.45, gesture.startScale * distance / gesture.startDistance));
      } else if (gesture.mode === 'drag' && bounds.width && bounds.height) {
        layout.x = Math.min(110, Math.max(-10, gesture.startLayout.x + (event.clientX - gesture.startPointer.x) / bounds.width * 100));
        layout.y = Math.min(110, Math.max(-10, gesture.startLayout.y + (event.clientY - gesture.startPointer.y) / bounds.height * 100));
      }
      applyPieceLayout(element, layout);
    });

    const finishGesture = (event) => {
      const gesture = pieceGestures.get(piece.id);
      if (!gesture?.pointers.has(event.pointerId)) return;
      gesture.pointers.delete(event.pointerId);
      if (gesture.pointers.size === 1) {
        const [pointer] = gesture.pointers.values();
        gesture.mode = 'drag';
        gesture.startPointer = { ...pointer };
        gesture.startLayout = { ...getPieceLayout(piece, getSelectedPieces().indexOf(piece)) };
      } else if (!gesture.pointers.size) {
        pieceGestures.delete(piece.id);
        element.classList.remove('is-active');
        element.style.zIndex = '';
      } else {
        gesture.mode = 'pinch';
        const [first, second] = [...gesture.pointers.values()];
        gesture.startDistance = Math.hypot(first.x - second.x, first.y - second.y);
        gesture.startScale = getPieceLayout(piece, getSelectedPieces().indexOf(piece)).scale;
      }
    };
    element.addEventListener('pointerup', finishGesture);
    element.addEventListener('pointercancel', finishGesture);
  }

  function updateActivePieceControls() {
    const piece = getSelectedPieces().find((entry) => entry.id === activePieceId);
    const controls = byId('collage-piece-controls');
    controls.hidden = !piece;
    byId('collage-selected-name').textContent = piece ? `调整：${piece.name}` : '';
    $$('.collage-piece', byId('collage-pieces')).forEach((element) => {
      element.classList.toggle('is-selected', element.dataset.collagePiece === activePieceId);
    });
  }

  function updateCollage() {
    const pieces = getSelectedPieces();
    byId('selected-count').textContent = `已选 ${pieces.length} 件`;
    byId('collage-placeholder').hidden = pieces.length > 0;
    if (!pieces.some((piece) => piece.id === activePieceId)) activePieceId = pieces.at(-1)?.id || '';
    byId('collage-pieces').innerHTML = pieces.map((piece) => `
      <div class="collage-piece" data-collage-piece="${escapeHtml(piece.id)}" aria-label="${escapeHtml(piece.name)}">
        ${imageMarkup(piece)}
      </div>
    `).join('');
    pieces.forEach((piece, index) => {
      const element = $(`[data-collage-piece="${CSS.escape(piece.id)}"]`, byId('collage-pieces'));
      applyPieceLayout(element, getPieceLayout(piece, index));
      attachPieceGestures(element, piece);
    });
    updateActivePieceControls();
    byId('collage-canvas').dataset.bg = selectedBackground;
  }

  function renderOutfits() {
    const container = byId('outfit-list');
    container.innerHTML = state.outfits.length ? state.outfits.slice().reverse().map((outfit) => `
      <article class="outfit-card">
        <div class="outfit-thumb" data-bg="${escapeHtml(outfit.background || 'blue')}">
          ${outfit.image ? `<img src="${outfit.image}" alt="${escapeHtml(outfit.name)}">` : '<span class="placeholder-star">✳</span>'}
        </div>
        <div class="outfit-info"><strong>${escapeHtml(outfit.name)}</strong>
          <div class="outfit-info-row"><span>${escapeHtml(outfit.category)} · ${outfit.pieces.length} 件</span>
            <button data-wear-outfit="${escapeHtml(outfit.id)}">今天穿了 ♡</button>
          </div>
        </div>
      </article>
    `).join('') : '<div class="empty-state"><span class="empty-state-icon">✧</span><strong>你的第一套搭配，等你來保存</strong><p>选择衣橱单品，拼出今天的穿搭灵感。</p></div>';
  }

  function renderProfile() {
    byId('stat-items').textContent = String(state.items.length);
    byId('stat-value').textContent = formatPrice(state.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
    byId('stat-wears').textContent = String(state.items.reduce((sum, item) => sum + (Number(item.wears) || 0), 0));
    byId('stat-outfits').textContent = String(state.outfits.length);
  }

  function renderAll() {
    renderWardrobe();
    renderPicker();
    renderOutfits();
    renderProfile();
  }

  function showView(name) {
    activeView = name;
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}-view`));
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.nav === name));
    byId('header-add').hidden = name !== 'wardrobe';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openModal(content) {
    const root = byId('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true"></section></div>`;
    const card = $('.modal-card', root);
    card.innerHTML = content;
    $('.modal-backdrop', root).addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeModal();
    });
    $('.modal-close', card)?.addEventListener('click', closeModal);
    $('.modal-card', root).addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
    card.focus({ preventScroll: true });
    return card;
  }

  function closeModal() {
    byId('modal-root').innerHTML = '';
    pendingPhoto = '';
    pendingPhotoCutout = false;
  }

  function openItemModal(item = null, image = '', cutout = false) {
    pendingPhoto = image || item?.image || '';
    pendingPhotoCutout = cutout || Boolean(item?.cutout);
    const isEditing = Boolean(item);
    const card = openModal(`
      <button type="button" class="modal-close" aria-label="关闭">×</button>
      <span class="eyebrow">${isEditing ? 'EDIT YOUR FAVORITE' : 'A NEW FAVORITE'}</span>
      <h2>${isEditing ? '编辑衣物' : '添加一件心爱单品'}</h2>
      <p class="modal-subtitle">照片保留原始背景并保存在本机；填写信息后保存到你的衣橱。</p>
      <div class="upload-zone" aria-live="polite">
        <span class="upload-preview">${pendingPhoto ? `<img src="${pendingPhoto}" alt="衣物预览">` : '<span class="empty-state-icon">📷</span>'}</span>
        <strong>${pendingPhoto ? '衣物照片预览' : '添加衣物照片'}</strong>
        <span>保留照片原始背景，不会自动抠图</span>
      </div>
      <input id="item-gallery-input" type="file" accept="image/*" hidden>
      <input id="item-camera-input" type="file" accept="image/*" capture="environment" hidden>
      <div class="photo-actions"><button class="button button-outline" id="take-item-photo" type="button">拍照</button><button class="button button-outline" id="choose-item-photo" type="button">从相册选择</button></div>
      <div class="processing-hint" id="processing-hint" hidden><span class="spinner"></span>正在载入照片…</div>
      <form id="item-form">
        <div class="form-grid">
          <div class="form-field full"><label for="item-name">名称 *</label><input id="item-name" name="name" required maxlength="45" placeholder="例如：雾霾蓝针织衫" value="${escapeHtml(item?.name || '')}"></div>
          <div class="form-field"><label for="item-category">分类 *</label><select id="item-category" name="category" required>${itemCategories.map((value) => `<option ${item?.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
          <div class="form-field"><label for="item-season">季节</label><select id="item-season" name="season">${seasons.map((value) => `<option ${item?.season === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
          <div class="form-field"><label for="item-brand">品牌</label><input id="item-brand" name="brand" maxlength="35" placeholder="品牌名称" value="${escapeHtml(item?.brand || '')}"></div>
          <div class="form-field"><label for="item-price">价格（元）</label><input id="item-price" name="price" type="number" min="0" step="0.01" placeholder="0.00" value="${item?.price ?? ''}"></div>
          <div class="form-field"><label for="item-rating">喜欢程度</label><select id="item-rating" name="rating">${[5, 4, 3, 2, 1].map((value) => `<option value="${value}" ${Number(item?.rating || 5) === value ? 'selected' : ''}>${'★'.repeat(value)}${'☆'.repeat(5 - value)}</option>`).join('')}</select></div>
          <div class="form-field"><label for="item-wears">穿着次数</label><input id="item-wears" name="wears" type="number" min="0" step="1" value="${Number(item?.wears) || 0}"></div>
          <div class="form-field full"><label for="item-keywords">关键词</label><input id="item-keywords" name="keywords" maxlength="100" placeholder="用逗号分隔，例如：通勤,蓝色,百搭" value="${escapeHtml(item?.keywords || '')}"></div>
          <div class="form-field full"><label for="item-outfits">相关搭配</label><textarea id="item-outfits" name="relatedOutfits" maxlength="180" placeholder="记录适合的搭配，例如：白衬衫 + 牛仔裤">${escapeHtml(item?.relatedOutfits?.join(', ') || '')}</textarea></div>
        </div>
        <div class="modal-actions">${isEditing ? '<button class="button danger-button" type="button" id="delete-item">删除</button>' : ''}<button class="button button-outline" type="button" id="cancel-modal">取消</button><button class="button button-primary" type="submit">保存到衣橱</button></div>
      </form>
    `);

    $('#cancel-modal', card).addEventListener('click', closeModal);
    $('#take-item-photo', card).addEventListener('click', () => $('#item-camera-input', card).click());
    $('#choose-item-photo', card).addEventListener('click', () => $('#item-gallery-input', card).click());
    const handleItemPhoto = async (event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('请选择有效的图片文件');
        return;
      }
      $('#processing-hint', card).hidden = false;
      try {
        pendingPhoto = await fileToDataUrl(file);
        pendingPhotoCutout = false;
        $('.upload-preview', card).innerHTML = `<img src="${pendingPhoto}" alt="衣物预览">`;
        $('.upload-zone strong', card).textContent = '照片已载入 · 点击更换';
        showToast('照片已载入，保留原始背景');
      } catch (error) {
        console.error('读取衣物图片失败。', error);
        showToast('无法读取这张图片，请换一张试试');
      } finally {
        $('#processing-hint', card).hidden = true;
        input.value = '';
      }
    };
    $('#item-gallery-input', card).addEventListener('change', handleItemPhoto);
    $('#item-camera-input', card).addEventListener('change', handleItemPhoto);

    $('#delete-item', card)?.addEventListener('click', () => {
      if (!window.confirm(`确定从衣橱删除「${item.name}」吗？`)) return;
      state.items = state.items.filter((entry) => entry.id !== item.id);
      selectedPieceIds = selectedPieceIds.filter((id) => id !== item.id);
      saveState();
      closeModal();
      renderAll();
      showToast('已从衣橱移除');
    });

    $('#item-form', card).addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') || '').trim();
      if (!name) {
        $('#item-name', card).focus();
        return;
      }
      const itemData = {
        id: item?.id || makeId(),
        name,
        category: String(form.get('category')),
        season: String(form.get('season')),
        brand: String(form.get('brand') || '').trim(),
        price: Number(form.get('price')) || 0,
        rating: Number(form.get('rating')) || 0,
        wears: Math.max(0, Number(form.get('wears')) || 0),
        keywords: String(form.get('keywords') || '').trim(),
        relatedOutfits: String(form.get('relatedOutfits') || '').split(/[,，]/).map((value) => value.trim()).filter(Boolean),
        image: pendingPhoto,
        cutout: pendingPhotoCutout,
        tint: item?.tint || '#edf2fa',
        emoji: item?.emoji || categoryEmoji[String(form.get('category'))],
        createdAt: item?.createdAt || Date.now()
      };
      if (item) {
        state.items = state.items.map((entry) => entry.id === item.id ? itemData : entry);
      } else {
        state.items.push(itemData);
      }
      if (!saveState()) return;
      closeModal();
      renderAll();
      showToast(item ? '衣物信息已更新' : '新单品已加入衣橱');
    });
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function startImport() {
    openItemModal();
  }

  function togglePiece(id) {
    selectedPieceIds = selectedPieceIds.includes(id) ? selectedPieceIds.filter((itemId) => itemId !== id) : [...selectedPieceIds, id];
    renderPicker();
  }

  async function addOutfitPhotos(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        extraPieces.push({
          id: makeId(),
          name: file.name.replace(/\.[^.]+$/, '') || '我的照片',
          category: '搭配图片',
          image: await fileToDataUrl(file),
          cutout: false,
          emoji: '✿'
        });
      } catch (error) {
        console.error('导入搭配图片失败。', error);
        showToast(`无法读取 ${file.name}`);
      }
    }
    renderPicker();
    if (files.length && extraPieces.length) showToast('已把照片加入拼图');
  }

  function captureCollage(pieces, background) {
    return new Promise(async (resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve('');
        return;
      }
      const colors = { blue: '#e4ecfc', lavender: '#ebe6f4', pink: '#f6e8ec', cream: '#f5efe2', mint: '#e6eee7' };
      context.fillStyle = colors[background] || colors.blue;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#556b91';
      context.font = '600 19px sans-serif';
      context.fillText('TODAY, I LIKE THIS.', 32, 39);
      const drawImage = (source, x, y, w, h, angle, scale) => new Promise((resolveDraw) => {
        const image = new Image();
        image.onload = () => {
          context.save();
          context.translate(x + w / 2, y + h / 2);
          context.rotate(angle);
          const ratio = Math.min(w / image.width, h / image.height) * scale;
          const drawWidth = image.width * ratio;
          const drawHeight = image.height * ratio;
          context.shadowColor = '#56617d30';
          context.shadowBlur = 12;
          context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          context.restore();
          resolveDraw();
        };
        image.onerror = () => resolveDraw();
        image.src = source;
      });
      for (let index = 0; index < pieces.length; index += 1) {
        const piece = pieces[index];
        const layout = getPieceLayout(piece, index);
        const placement = [layout.x / 100 * 720 - 151, layout.y / 100 * 720 - 144, 302, 288, layout.rotation * Math.PI / 180, layout.scale];
        if (piece.image) {
          await drawImage(piece.image, ...placement);
        } else {
          context.font = `${110 * layout.scale}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          context.textAlign = 'center';
          context.fillText(piece.emoji || '✿', placement[0] + placement[2] / 2, placement[1] + placement[3] / 2);
        }
      }
      context.textAlign = 'right';
      context.fillStyle = '#50658ba8';
      context.font = 'italic 16px sans-serif';
      context.fillText('little things, lovely days', 692, 697);
      resolve(canvas.toDataURL('image/webp', 0.76));
    });
  }

  function openSaveOutfitModal() {
    const pieces = getSelectedPieces();
    if (!pieces.length) {
      showToast('先从衣橱选几件单品，或添加一张搭配图片');
      return;
    }
    const card = openModal(`
      <button type="button" class="modal-close" aria-label="关闭">×</button>
      <span class="eyebrow">SAVE YOUR LOOK</span>
      <h2>收藏这套搭配</h2>
      <p class="modal-subtitle">给今天的穿搭取个名字，记录灵感分类。</p>
      <form id="outfit-form">
        <div class="form-grid">
          <div class="form-field full"><label for="outfit-name">搭配名称 *</label><input id="outfit-name" name="name" required maxlength="40" placeholder="例如：周五的蓝色好心情"></div>
          <div class="form-field full"><label for="outfit-category">穿搭分类</label><select id="outfit-category" name="category">${outfitCategories.map((name) => `<option>${name}</option>`).join('')}</select></div>
          <div class="form-field full"><label for="outfit-note">搭配备注</label><textarea id="outfit-note" name="note" maxlength="140" placeholder="记录搭配心情或穿着场合…"></textarea></div>
        </div>
        <div class="modal-actions"><button class="button button-outline" type="button" id="cancel-outfit">取消</button><button class="button button-primary" type="submit">保存搭配</button></div>
      </form>
    `);
    $('#cancel-outfit', card).addEventListener('click', closeModal);
    $('#outfit-form', card).addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = $('button[type="submit"]', card);
      submit.disabled = true;
      submit.textContent = '正在保存…';
      const form = new FormData(event.currentTarget);
      const outfit = {
        id: makeId(),
        name: String(form.get('name') || '').trim(),
        category: String(form.get('category') || outfitCategories[0]),
        note: String(form.get('note') || '').trim(),
        background: selectedBackground,
        image: await captureCollage(pieces, selectedBackground),
        pieces: pieces.map((piece) => piece.id),
        layout: pieces.map((piece, index) => ({ id: piece.id, ...getPieceLayout(piece, index) })),
        createdAt: Date.now()
      };
      state.outfits.push(outfit);
      pieces.forEach((piece) => {
        const item = state.items.find((entry) => entry.id === piece.id);
        if (item && !item.relatedOutfits.includes(outfit.name)) item.relatedOutfits.push(outfit.name);
      });
      if (!saveState()) {
        state.outfits.pop();
        return;
      }
      closeModal();
      selectedPieceIds = [];
      extraPieces = [];
      renderAll();
      showToast('今日搭配已收藏到灵感手册');
    });
  }

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      showView(nav.dataset.nav);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action?.dataset.action === 'import') {
      startImport();
      return;
    }
    const category = event.target.closest('[data-category]');
    if (category) {
      activeCategory = category.dataset.category;
      renderWardrobe();
      return;
    }
    const edit = event.target.closest('[data-edit-item]');
    if (edit) {
      const item = state.items.find((entry) => entry.id === edit.dataset.editItem);
      if (item) openItemModal(item);
      return;
    }
    const pick = event.target.closest('[data-pick-item]');
    if (pick) {
      togglePiece(pick.dataset.pickItem);
      return;
    }
    const zoom = event.target.closest('[data-active-piece-zoom]');
    if (zoom) {
      const pieces = getSelectedPieces();
      const piece = pieces.find((entry) => entry.id === activePieceId);
      if (!piece) return;
      const layout = getPieceLayout(piece, pieces.indexOf(piece));
      layout.scale = Math.min(2.4, Math.max(0.45, layout.scale + Number(zoom.dataset.activePieceZoom) * 0.15));
      const element = $(`[data-collage-piece="${CSS.escape(piece.id)}"]`, byId('collage-pieces'));
      applyPieceLayout(element, layout);
      return;
    }
    const rotate = event.target.closest('[data-active-piece-rotate]');
    if (rotate) {
      const pieces = getSelectedPieces();
      const piece = pieces.find((entry) => entry.id === activePieceId);
      if (!piece) return;
      const layout = getPieceLayout(piece, pieces.indexOf(piece));
      layout.rotation += Number(rotate.dataset.activePieceRotate) * 15;
      const element = $(`[data-collage-piece="${CSS.escape(piece.id)}"]`, byId('collage-pieces'));
      applyPieceLayout(element, layout);
      return;
    }
    const removePiece = event.target.closest('[data-active-piece-remove]');
    if (removePiece) {
      const id = activePieceId;
      if (!id) return;
      selectedPieceIds = selectedPieceIds.filter((pieceId) => pieceId !== id);
      extraPieces = extraPieces.filter((piece) => piece.id !== id);
      delete pieceLayouts[id];
      activePieceId = '';
      renderPicker();
      return;
    }
    const swatch = event.target.closest('.swatch');
    if (swatch) {
      selectedBackground = swatch.dataset.bg;
      $$('.swatch').forEach((button) => button.classList.toggle('selected', button === swatch));
      updateCollage();
      return;
    }
    if (event.target.closest('#header-add')) {
      startImport();
      return;
    }
    if (event.target.closest('#sort-toggle')) {
      sortNewest = !sortNewest;
      byId('sort-toggle').innerHTML = sortNewest ? '最近添加 <span>⌄</span>' : '名称排序 <span>⌄</span>';
      renderWardrobe();
      return;
    }
    if (event.target.closest('#add-outfit-photo')) {
      byId('outfit-file-input').click();
      return;
    }
    if (event.target.closest('#clear-collage')) {
      selectedPieceIds = [];
      extraPieces = [];
      renderPicker();
      return;
    }
    if (event.target.closest('#save-outfit')) {
      openSaveOutfitModal();
      return;
    }
    const wearButton = event.target.closest('[data-wear-outfit]');
    if (wearButton) {
      const outfit = state.outfits.find((entry) => entry.id === wearButton.dataset.wearOutfit);
      if (!outfit) return;
      outfit.pieces.forEach((id) => {
        const item = state.items.find((entry) => entry.id === id);
        if (item) item.wears = (Number(item.wears) || 0) + 1;
      });
      if (saveState()) {
        renderAll();
        showToast('穿着记录已更新，今天也要喜欢自己 ♡');
      }
      return;
    }
    if (event.target.closest('#reset-data')) {
      if (!window.confirm('确定清空这台设备上保存的衣物和搭配吗？此操作无法撤销。')) return;
      state = { items: [], outfits: [] };
      selectedPieceIds = [];
      extraPieces = [];
      saveState();
      renderAll();
      showToast('本机衣橱已清空');
    }
  });

  byId('wardrobe-search').addEventListener('input', renderWardrobe);
  byId('outfit-file-input').addEventListener('change', async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length) await addOutfitPhotos(files);
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      showView('wardrobe');
      byId('wardrobe-search').focus();
    }
    if (event.key === 'Escape' && $('.modal-backdrop')) closeModal();
  });

  renderAll();
  showView(activeView);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((error) => {
        console.error('离线应用初始化失败。', error);
      });
    });
  }
})();
