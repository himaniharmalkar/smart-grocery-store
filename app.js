let products = [];
let cart = [];

// Fetch products from the API
async function fetchProducts() {
    try {
        const response = await fetch('http://localhost:5000/products');
        products = await response.json();
        renderProducts();
        populateCategorySelect();
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Render products in the product list
function renderProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    const selectedCategory = document.getElementById('category-select').value;

    products.forEach(product => {
        if (selectedCategory === 'all' || product.category === selectedCategory) {
            const productElement = createProductElement(product);
            productList.appendChild(productElement);
        }
    });
}

// Create a product element
function createProductElement(product) {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-card';
    productDiv.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <div class="product-details">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-category">${product.category}</p>
            <p class="product-price">₹${product.price.toFixed(2)}</p>
            <div class="add-to-cart">
                <select class="quantity-select" id="quantity-${product.id}">
                    ${[...Array(10)].map((_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                </select>
                <button class="add-button" onclick="addToCart(${product.id})">
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `;
    return productDiv;
}

// Populate category select
function populateCategorySelect() {
    const categorySelect = document.getElementById('category-select');
    const categories = [...new Set(products.map(product => product.category))];
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Filter products based on selected category
function filterProducts() {
    renderProducts();
}

// Add a product to the cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const quantity = parseInt(document.getElementById(`quantity-${productId}`).value);
    if (product) {
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({...product, quantity});
        }
        updateCartCount();
        fetchRecommendations();
    }
}

// Update cart count
function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
}

// Fetch recommendations based on cart items
async function fetchRecommendations() {
    try {
        const response = await fetch('http://localhost:5000/recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cart_items: cart.map(item => item.name) }),
        });
        const data = await response.json();
        renderRecommendations(data.recommendations, 'cart-recommendations');
        renderRecommendations(data.frequently_bought_together, 'frequent-items');
    } catch (error) {
        console.error('Error fetching recommendations:', error);
    }
}

// Render recommendations
function renderRecommendations(recommendedProducts, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (containerId === 'frequent-items') {
        // Render Frequently Bought Together section
        const frequentItemsContainer = document.createElement('div');
        frequentItemsContainer.className = 'frequent-items-container';
        
        const itemsGroup = document.createElement('div');
        itemsGroup.className = 'frequent-items-group';
        
        let totalPrice = 0;
        recommendedProducts.forEach((product, index) => {
            // Create product card
            const itemCard = document.createElement('div');
            itemCard.className = 'frequent-item-card';
            itemCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <div class="product-name">${product.name}</div>
                <div class="product-price">₹${product.price.toFixed(2)}</div>
            `;
            itemsGroup.appendChild(itemCard);
            
            // Add plus symbol between products
            if (index < recommendedProducts.length - 1) {
                const plusSymbol = document.createElement('div');
                plusSymbol.className = 'plus-symbol';
                plusSymbol.textContent = '+';
                itemsGroup.appendChild(plusSymbol);
            }
            
            totalPrice += product.price;
        });
        
        // Add summary section
        const summary = document.createElement('div');
        summary.className = 'frequent-items-summary';
        summary.innerHTML = `
            <div class="bundle-total">Total Bundle Price: ₹${totalPrice.toFixed(2)}</div>
            <button class="add-bundle-button" onclick="addBundleToCart(${JSON.stringify(recommendedProducts.map(p => p.id))})">
                <i class="fas fa-cart-plus"></i>
                Add All to Cart
            </button>
        `;
        
        frequentItemsContainer.appendChild(itemsGroup);
        frequentItemsContainer.appendChild(summary);
        container.appendChild(frequentItemsContainer);
    } else {
        // Render regular recommendations with smaller cards
        recommendedProducts.forEach(product => {
            const productElement = createRecommendedProductElement(product);
            container.appendChild(productElement);
        });
    }
}
function createRecommendedProductElement(product) {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-card recommended-card'; // Add recommended-card class
    productDiv.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <div class="product-details">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-category">${product.category}</p>
            <p class="product-price">₹${product.price.toFixed(2)}</p>
            <div class="add-to-cart">
                <select class="quantity-select" id="quantity-${product.id}">
                    ${[...Array(5)].map((_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                </select>
                <button class="add-button" onclick="addToCart(${product.id})">
                    <i class="fas fa-cart-plus"></i>
                </button>
            </div>
        </div>
    `;
    return productDiv;
}

// Add entire bundle to cart
function addBundleToCart(productIds) {
    productIds.forEach(productId => {
        const product = products.find(p => p.id === productId);
        if (product) {
            const existingItem = cart.find(item => item.id === productId);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({...product, quantity: 1});
            }
        }
    });
    updateCartCount();
    renderCart();
    // Show a success message
    alert('Bundle added to cart successfully!');
}

// Show cart page
function showCartPage() {
    document.getElementById('store-page').style.display = 'none';
    document.getElementById('cart-page').style.display = 'block';
    renderCart();
}

// Hide cart page
function hideCartPage() {
    document.getElementById('store-page').style.display = 'block';
    document.getElementById('cart-page').style.display = 'none';
}

// Render the cart
function renderCart() {
    const cartItems = document.getElementById('cart-items-full');
    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-details">
                <h3>${item.name}</h3>
                <p class="product-price">₹${item.price.toFixed(2)} x ${item.quantity}</p>
                <p class="product-price">Total: ₹${(item.price * item.quantity).toFixed(2)}</p>
            </div>
            <button class="remove-button" onclick="removeFromCart(${item.id})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        cartItems.appendChild(cartItem);
        total += item.price * item.quantity;
    });

    document.getElementById('cart-summary-total').textContent = `Total: ₹${total.toFixed(2)}`;
}

// Remove a product from the cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartCount();
    renderCart();
    fetchRecommendations();
}

// Initialize the page
fetchProducts();