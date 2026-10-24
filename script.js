// Set up product carousel arrows, dragging, touch snapping, and keyboard controls.
(() => {
  const carousel = document.getElementById('productsCarousel');
  const btnPrev = document.querySelector('.carousel-arrow.prev');
  const btnNext = document.querySelector('.carousel-arrow.next');

  function cardWidth() {
    const card = carousel.querySelector('.product-card');
    if (!card) return carousel.clientWidth;
    const gap = parseFloat(getComputedStyle(carousel).gap || 16);
    return card.getBoundingClientRect().width + gap;
  }

  btnPrev.addEventListener('click', () => {
    carousel.scrollBy({ left: -cardWidth(), behavior: 'smooth' });
  });

  btnNext.addEventListener('click', () => {
    carousel.scrollBy({ left: cardWidth(), behavior: 'smooth' });
  });

  let isDragging = false;
  let dragStartX = 0;
  let startingScrollLeft = 0;

  carousel.addEventListener('mousedown', (event) => {
    isDragging = true;
    carousel.classList.add('dragging');
    dragStartX = event.pageX - carousel.offsetLeft;
    startingScrollLeft = carousel.scrollLeft;
  });

  function stopDragging() {
    isDragging = false;
    carousel.classList.remove('dragging');
  }

  carousel.addEventListener('mouseleave', stopDragging);
  carousel.addEventListener('mouseup', stopDragging);
  carousel.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    event.preventDefault();
    const currentX = event.pageX - carousel.offsetLeft;
    carousel.scrollLeft = startingScrollLeft - (currentX - dragStartX);
  });

  carousel.addEventListener('touchend', () => {
    const width = cardWidth();
    const index = Math.round(carousel.scrollLeft / width);
    carousel.scrollTo({ left: index * width, behavior: 'smooth' });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') btnNext.click();
    if (event.key === 'ArrowLeft') btnPrev.click();
  });
})();

// Manage saved favorites, cart quantities, totals, and browser storage.
(() => {
  const cards = [...document.querySelectorAll('.product-card')];
  const products = new Map(cards.map((card) => {
    const title = card.querySelector('.product-title').textContent.trim();
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const price = Number(card.querySelector('.price').textContent.replace(/[^0-9.]/g, ''));
    const image = card.querySelector('.product-image-primary');
    return [id, { id, title, price, image: image.getAttribute('src'), card }];
  }));
  const productByCard = new Map([...products.values()].map((product) => [product.card, product]));
  const favoriteButton = document.querySelector('.nav-icon.favorite');
  const cartButton = document.querySelector('.nav-icon.cart');
  const favoritesPanel = document.getElementById('favorites-panel');
  const cartPanel = document.getElementById('cart-panel');
  const favoritesList = favoritesPanel.querySelector('.favorites-list');
  const cartList = cartPanel.querySelector('.cart-list');
  const status = document.querySelector('.shop-status');
  const favoritesKey = 'tintbar-favorites';
  const cartKey = 'tintbar-cart';

  function showStorageError() {
    status.textContent = 'Your changes are active for this visit, but could not be saved on this device.';
  }

  function load(key, normalize) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? normalize(JSON.parse(saved)) : [];
    } catch (error) {
      showStorageError();
      return [];
    }
  }

  // Load and validate stored product IDs and cart quantities.
  let favorites = load(favoritesKey, (value) =>
    Array.isArray(value) ? value.filter((id) => typeof id === 'string' && products.has(id)) : []
  );
  let cart = load(cartKey, (value) =>
    Array.isArray(value)
      ? value.filter((item) => item && typeof item.id === 'string' && products.has(item.id) &&
          Number.isInteger(item.quantity) && item.quantity > 0)
      : []
  );

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      status.textContent = '';
    } catch (error) {
      showStorageError();
    }
  }

  // Action buttons for removing favorites and managing cart quantities.
  function createButton(label, action, id, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.productId = id;
    button.className = className || 'panel-action';
    return button;
  }

  // header counts, favorite states, item thumbnails, and cart subtotal.
  function render() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    const favoriteCount = favoriteButton.querySelector('.nav-count');
    const cartCountBadge = cartButton.querySelector('.nav-count');

    favoriteCount.textContent = String(favorites.length);
    favoriteCount.hidden = favorites.length === 0;
    cartCountBadge.textContent = String(cartCount);
    cartCountBadge.hidden = cartCount === 0;
    favoriteButton.setAttribute('aria-label', `Favorites, ${favorites.length} items`);
    cartButton.setAttribute('aria-label', `Cart, ${cartCount} items`);

    cards.forEach((card) => {
      const product = productByCard.get(card);
      const liked = favorites.includes(product.id);
      const button = card.querySelector('.like-btn');
      button.setAttribute('aria-pressed', String(liked));
      button.setAttribute('aria-label', liked ? `Remove ${product.title} from favorites` : `Add ${product.title} to favorites`);
      button.querySelector('i').className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      button.classList.toggle('is-liked', liked);
    });

    favoritesList.replaceChildren();
    favorites.forEach((id) => {
      const product = products.get(id);
      const item = document.createElement('li');
      const image = document.createElement('img');
      image.className = 'panel-product-image';
      image.src = product.image;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.textContent = product.title;
      name.className = 'panel-product-name';
      item.append(image, name, createButton('Remove', 'remove-favorite', id));
      favoritesList.append(item);
    });
    favoritesPanel.querySelector('.nav-panel-empty').hidden = favorites.length > 0;

    cartList.replaceChildren();
    let subtotal = 0;
    cart.forEach(({ id, quantity }) => {
      const product = products.get(id);
      subtotal += product.price * quantity;
      const item = document.createElement('li');
      const image = document.createElement('img');
      image.className = 'panel-product-image';
      image.src = product.image;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      const details = document.createElement('span');
      details.className = 'cart-item-details';
      details.textContent = `${product.title} · $${product.price.toFixed(2)} × ${quantity}`;
      const controls = document.createElement('span');
      controls.className = 'cart-item-controls';
      controls.append(
        createButton('−', 'decrease-cart', id, 'quantity-action'),
        createButton('+', 'increase-cart', id, 'quantity-action'),
        createButton('Remove', 'remove-cart', id)
      );
      item.append(image, details, controls);
      cartList.append(item);
    });
    cartPanel.querySelector('.nav-panel-empty').hidden = cart.length > 0;
    const subtotalElement = cartPanel.querySelector('.cart-subtotal');
    subtotalElement.textContent = `Subtotal: $${subtotal.toFixed(2)}`;
    subtotalElement.hidden = cart.length === 0;
  }

  // to Open the selected header panel and close the other panel.
  function setPanel(button, panel, open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function togglePanel(button, panel, otherButton, otherPanel) {
    const opening = panel.hidden;
    setPanel(otherButton, otherPanel, false);
    setPanel(button, panel, opening);
  }

  favoriteButton.addEventListener('click', () => togglePanel(favoriteButton, favoritesPanel, cartButton, cartPanel));
  cartButton.addEventListener('click', () => togglePanel(cartButton, cartPanel, favoriteButton, favoritesPanel));

  // This Toggle favorites and add products to the cart with temporary button feedback.
  cards.forEach((card) => {
    const product = productByCard.get(card);
    card.querySelector('.like-btn').addEventListener('click', () => {
      favorites = favorites.includes(product.id)
        ? favorites.filter((id) => id !== product.id)
        : [...favorites, product.id];
      save(favoritesKey, favorites);
      status.textContent = `${product.title} ${favorites.includes(product.id) ? 'added to' : 'removed from'} favorites.`;
      render();
    });

    const addCartButton = card.querySelector('.add-cart');
    const addCartLabel = addCartButton.textContent;
    let addCartFeedbackTimer;
    addCartButton.addEventListener('click', () => {
      const existing = cart.find((item) => item.id === product.id);
      if (existing) existing.quantity += 1;
      else cart.push({ id: product.id, quantity: 1 });
      save(cartKey, cart);
      status.textContent = `${product.title} added to cart.`;
      addCartButton.textContent = 'Added ✓';
      addCartButton.setAttribute('aria-label', `${product.title} added to cart`);
      addCartButton.classList.add('is-added');
      clearTimeout(addCartFeedbackTimer);
      addCartFeedbackTimer = setTimeout(() => {
        addCartButton.textContent = addCartLabel;
        addCartButton.setAttribute('aria-label', `Add ${product.title} to cart`);
        addCartButton.classList.remove('is-added');
      }, 1800);
      render();
    });
  });

  // This Handles delegated remove and quantity controls inside the two panels.
  [favoritesList, cartList].forEach((list) => {
    list.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const { action, productId } = button.dataset;

      if (action === 'remove-favorite') {
        favorites = favorites.filter((id) => id !== productId);
        save(favoritesKey, favorites);
        status.textContent = `${products.get(productId).title} removed from favorites.`;
      } else if (action === 'remove-cart') {
        cart = cart.filter((item) => item.id !== productId);
        save(cartKey, cart);
        status.textContent = `${products.get(productId).title} removed from cart.`;
      } else {
        const item = cart.find((entry) => entry.id === productId);
        if (!item) return;
        if (action === 'increase-cart') item.quantity += 1;
        if (action === 'decrease-cart') {
          if (item.quantity === 1) cart = cart.filter((entry) => entry.id !== productId);
          else item.quantity -= 1;
        }
        save(cartKey, cart);
      }
      render();
    });
  });

  // Close open panels when clicking outside them or pressing Escape.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-action')) {
      setPanel(favoriteButton, favoritesPanel, false);
      setPanel(cartButton, cartPanel, false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setPanel(favoriteButton, favoritesPanel, false);
      setPanel(cartButton, cartPanel, false);
    }
  });

  render();
})();

// Control the responsive menu and dropdown navigation.
(() => {
  const header = document.querySelector('.header');
  const menuButton = header.querySelector('.menu');
  const dropdownTriggers = header.querySelectorAll('.dropdown-trigger');

  menuButton.addEventListener('click', () => {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isExpanded));
    header.classList.toggle('menu-open', !isExpanded);

    if (isExpanded) {
      dropdownTriggers.forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.closest('.nav-item').classList.remove('dropdown-open');
      });
    }
  });

  dropdownTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const item = trigger.closest('.nav-item');
      const shouldOpen = !item.classList.contains('dropdown-open');

      dropdownTriggers.forEach((otherTrigger) => {
        otherTrigger.setAttribute('aria-expanded', 'false');
        otherTrigger.closest('.nav-item').classList.remove('dropdown-open');
      });

      if (shouldOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        item.classList.add('dropdown-open');
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) {
      dropdownTriggers.forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.closest('.nav-item').classList.remove('dropdown-open');
      });
    }
  });

  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dropdownTriggers.forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.closest('.nav-item').classList.remove('dropdown-open');
      });
    }
  });
})();

// Preserve the "See all products" navigation without an inline HTML handler.
document.querySelector('.see-all').addEventListener('click', () => {
  location.href = '/shop';
});
