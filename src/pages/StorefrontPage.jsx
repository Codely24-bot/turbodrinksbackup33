import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck
} from "lucide-react";
import { api, socket } from "../api";
import BrandLogo from "../components/BrandLogo";
import ProductCard from "../components/ProductCard";
import CartDrawer from "../components/CartDrawer";

const CART_KEY = "turbo_cart";
const CUSTOMER_KEY = "turbo_customer";
const LAST_ORDER_KEY = "turbo_last_order";
const STORE_CACHE_KEY = "turbo_store_cache";

const emptyForm = {
  name: "",
  phone: "",
  address: "",
  neighborhood: "",
  paymentMethod: "pix",
  needsChange: false,
  changeFor: "",
  note: "",
  couponCode: ""
};

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const sanitizeStoredCart = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({
      id: String(item?.id || "").trim(),
      quantity: Number.parseInt(item?.quantity, 10)
    }))
    .filter((item) => item.id && Number.isFinite(item.quantity) && item.quantity > 0);

const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
const normalizeProduct = (product) => {
  const salePrice = Number(product?.salePrice ?? product?.price ?? 0);
  const originalPrice = Number(
    product?.originalPrice ?? product?.price ?? product?.salePrice ?? salePrice
  );

  return {
    ...product,
    price: salePrice,
    originalPrice
  };
};

const normalizeStore = (payload) => {
  if (!payload) {
    return payload;
  }

  return {
    ...payload,
    products: (payload.products || []).map(normalizeProduct),
    featuredProducts: (payload.featuredProducts || []).map(normalizeProduct)
  };
};
const getCachedStore = () =>
  normalizeStore(
    safeParse(localStorage.getItem(STORE_CACHE_KEY), {
      settings: { deliveryFees: {} },
      categories: [],
      featuredProducts: [],
      promotions: [],
      products: []
    })
  );
const getWhatsAppLink = (settings) => {
  const phone = settings?.whatsappNumber || "";
  const message = settings?.quickMessage || "Quero fazer um pedido";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const estimateDiscount = (subtotal, promotions, couponCode) => {
  const coupon = promotions.find(
    (promotion) =>
      promotion.type === "coupon" &&
      promotion.code &&
      promotion.code.toLowerCase() === String(couponCode || "").trim().toLowerCase()
  );

  if (!coupon || subtotal < Number(coupon.minimumOrder || 0)) {
    return 0;
  }

  if (coupon.discountType === "percentage") {
    return Number(((subtotal * Number(coupon.discountValue || 0)) / 100).toFixed(2));
  }

  return Number(Number(coupon.discountValue || 0).toFixed(2));
};

const estimateDeliveryFee = (fees, promotions, neighborhood, subtotal) => {
  const fee = Number(fees[neighborhood] || 0);
  const freeShipping = promotions.some(
    (promotion) =>
      promotion.type === "shipping" &&
      promotion.active &&
      (!promotion.neighborhood || promotion.neighborhood === neighborhood) &&
      subtotal >= Number(promotion.minimumOrder || 0)
  );

  return freeShipping ? 0 : fee;
};

function StorefrontPage() {
  const navigate = useNavigate();
  const [store, setStore] = useState(() => getCachedStore());
  const [loading, setLoading] = useState(() => !getCachedStore().products.length);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState(() => sanitizeStoredCart(safeParse(localStorage.getItem(CART_KEY), [])));
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...safeParse(localStorage.getItem(CUSTOMER_KEY), {})
  }));
  const [cartOpen, setCartOpen] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState(() => safeParse(localStorage.getItem(LAST_ORDER_KEY), null));

  useEffect(() => {
    const loadStore = async () => {
      try {
        const payload = await api.getStore();
        const normalizedStore = normalizeStore(payload);
        setStore(normalizedStore);
        localStorage.setItem(STORE_CACHE_KEY, JSON.stringify(normalizedStore));
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadStore();

    const handleCatalogUpdate = (payload) => {
      if (payload?.products) {
        const normalizedStore = normalizeStore(payload);
        setStore(normalizedStore);
        localStorage.setItem(STORE_CACHE_KEY, JSON.stringify(normalizedStore));
      } else {
        loadStore();
      }
    };

    socket.on("catalog:updated", handleCatalogUpdate);

    return () => {
      socket.off("catalog:updated", handleCatalogUpdate);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify({
        name: form.name,
        phone: form.phone,
        address: form.address,
        neighborhood: form.neighborhood,
        note: form.note
      })
    );
  }, [form.address, form.name, form.neighborhood, form.note, form.phone]);

  const quantities = useMemo(
    () => cart.reduce((accumulator, item) => ({ ...accumulator, [item.id]: item.quantity }), {}),
    [cart]
  );

  const productsById = useMemo(
    () =>
      store.products.reduce((accumulator, product) => {
        accumulator[product.id] = product;
        return accumulator;
      }, {}),
    [store.products]
  );

  const cartItems = useMemo(
    () =>
      cart
        .map((item) => {
          const product = productsById[item.id];
          return product ? { ...product, quantity: item.quantity } : null;
        })
        .filter(Boolean),
    [cart, productsById]
  );

  useEffect(() => {
    if (!store.products.length) {
      return;
    }

    setCart((current) => {
      const sanitizedCart = current
        .map((item) => {
          const product = productsById[item.id];

          if (!product || !product.active || product.stock <= 0) {
            return null;
          }

          return {
            id: item.id,
            quantity: Math.min(item.quantity, product.stock)
          };
        })
        .filter(Boolean);

      const changed =
        sanitizedCart.length !== current.length ||
        sanitizedCart.some(
          (item, index) =>
            item.id !== current[index]?.id || item.quantity !== current[index]?.quantity
        );

      if (changed) {
        setFeedback("Atualizamos seu carrinho com os itens disponiveis no momento.");
      }

      return changed ? sanitizedCart : current;
    });
  }, [productsById, store.products]);

  const filteredProducts =
    selectedCategory === "Todos"
      ? store.products
      : store.products.filter((product) => product.category === selectedCategory);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = estimateDeliveryFee(
    store.settings.deliveryFees || {},
    store.promotions || [],
    form.neighborhood,
    subtotal
  );
  const discount = estimateDiscount(subtotal, store.promotions || [], form.couponCode);
  const total = Math.max(subtotal + deliveryFee - discount, 0);
  const neighborhoodOptions = Object.keys(store.settings.deliveryFees || {});
  const whatsAppLink = getWhatsAppLink(store.settings);

  const updateQuantity = (productId, nextQuantity) => {
    if (nextQuantity <= 0) {
      setCart((current) => current.filter((item) => item.id !== productId));
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === productId);
      if (!existing) {
        return [...current, { id: productId, quantity: nextQuantity }];
      }

      return current.map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item));
    });
  };

  const addProduct = (productId) => {
    const quantity = quantities[productId] || 0;
    updateQuantity(productId, quantity + 1);
    setCartOpen(true);
  };

  const handleLookup = async () => {
    if (!lookupPhone.trim()) {
      setFeedback("Informe um telefone para localizar o cliente.");
      return;
    }

    setLookupLoading(true);
    setFeedback("");

    try {
      const result = await api.lookupCustomer(lookupPhone);
      setLookupResult(result);

      if (result.customer) {
        setForm((current) => ({
          ...current,
          name: result.customer.name,
          phone: result.customer.phone,
          address: result.customer.address,
          neighborhood: result.customer.neighborhood,
          note: result.customer.notes || current.note
        }));
      }
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRepeatOrder = (order) => {
    if (!order?.items?.length) {
      return;
    }

    const nextCart = order.items
      .map((item) => {
        if (!productsById[item.productId]) {
          return null;
        }
        return {
          id: item.productId,
          quantity: item.quantity
        };
      })
      .filter(Boolean);

    setCart(nextCart);
    setCartOpen(true);
    setFeedback("Ultimo pedido carregado no carrinho.");
  };

  const handleSubmitOrder = async () => {
    if (!cartItems.length) {
      setFeedback("Seu carrinho esta vazio.");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      const payload = await api.createOrder(
        {
          ...form,
          changeFor: form.needsChange ? form.changeFor : "",
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity
          }))
        },
        {
          preferredSource: store.source
        }
      );

      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(payload.order));
      setLastOrder(payload.order);
      setCart([]);
      setCartOpen(false);
      navigate(`/pedido/${payload.order.id}`);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell centered">
        <div className="loading-card">
          <span className="eyebrow">Carregando loja</span>
          <h1>Preparando o cardapio gelado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell storefront">
      <header className="hero-panel">
        <div className="topbar">
          <BrandLogo
            to="/"
            subtitle={store.settings.tagline}
            variant="storefront"
            className="brand-mark-storefront"
          />

        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-tag">
              <Sparkles size={14} />
              Pedido rapido, acompanhamento ao vivo e automacao no WhatsApp
            </span>
            <h1>{store.settings.bannerTitle}</h1>
            <p>{store.settings.bannerSubtitle}</p>

            <div className="hero-actions">
              <button type="button" className="button button-primary" onClick={() => setCartOpen(true)}>
                <ShoppingCart size={16} />
                Fazer pedido rapido
              </button>
            </div>

            <div className="hero-points">
              <span>
                <Clock3 size={16} />
                Atendimento expresso
              </span>
              <span>
                <Truck size={16} />
                Rastreio em tempo real
              </span>
              <span>
                <ShieldCheck size={16} />
                Checkout simples no celular
              </span>
            </div>
          </div>

          <aside className="hero-side-card">
            <span className="eyebrow">Promocoes do dia</span>
            <div className="promo-stack">
              {store.promotions.slice(0, 3).map((promotion) => (
                <article key={promotion.id} className="promo-item">
                  <strong>{promotion.title}</strong>
                  <p>{promotion.description}</p>
                  {promotion.highlight ? <span>{promotion.highlight}</span> : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      </header>

      <main className="main-content">
        <section className="cards-grid">
          <article className="info-card accent">
            <span className="eyebrow">Cliente recorrente</span>
            <h2>Repita seu ultimo pedido em um toque</h2>
            <p>Busque pelo telefone e traga seus dados e itens favoritos de volta ao carrinho.</p>
            <div className="lookup-row">
              <input
                value={lookupPhone}
                onChange={(event) => setLookupPhone(event.target.value)}
                placeholder="Digite seu telefone"
              />
              <button type="button" className="button button-primary" onClick={handleLookup} disabled={lookupLoading}>
                {lookupLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {lookupResult?.customer ? (
              <div className="lookup-result">
                <strong>{lookupResult.customer.name}</strong>
                <p>
                  Ultimo pedido em {new Date(lookupResult.lastOrder?.createdAt).toLocaleString("pt-BR")}
                </p>
                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => handleRepeatOrder(lookupResult.lastOrder)}
                >
                  <RotateCcw size={16} />
                  Repetir ultimo pedido
                </button>
              </div>
            ) : null}
          </article>

          <article className="info-card dark">
            <span className="eyebrow">Pedido rapido</span>
            <h2>Mais vendidos agora</h2>
            <ul className="mini-list">
              {store.featuredProducts.slice(0, 3).map((product) => (
                <li key={product.id}>
                  <img src={product.image} alt={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatCurrency(product.price)}</span>
                  </div>
                  <button type="button" className="button button-outline" onClick={() => addProduct(product.id)}>
                    <ArrowRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </article>
        </section>

        {lastOrder ? (
          <section className="repeat-banner">
            <div>
              <span className="eyebrow">Ultimo pedido salvo</span>
              <h2>Continue de onde voce parou</h2>
              <p>Seu ultimo pedido #{lastOrder.number} esta salvo para repetir ou acompanhar.</p>
            </div>
            <div className="repeat-actions">
              <button type="button" className="button button-soft" onClick={() => handleRepeatOrder(lastOrder)}>
                <RotateCcw size={16} />
                Repetir agora
              </button>
              <Link to={`/pedido/${lastOrder.id}`} className="button button-outline">
                <Truck size={16} />
                Acompanhar status
              </Link>
            </div>
          </section>
        ) : null}

        <section className="section-header">
          <div>
            <span className="eyebrow">Categorias</span>
            <h2>Escolha suas bebidas</h2>
          </div>
          <div className="chip-row">
            {["Todos", ...store.categories].map((category) => (
              <button
                type="button"
                key={category}
                className={`chip ${selectedCategory === category ? "is-active" : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="products-grid">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index < 4 ? "eager" : "lazy"}
              quantity={quantities[product.id] || 0}
              onAdd={() => addProduct(product.id)}
              onIncrease={() => updateQuantity(product.id, (quantities[product.id] || 0) + 1)}
              onDecrease={() => updateQuantity(product.id, (quantities[product.id] || 0) - 1)}
            />
          ))}
        </section>
      </main>

      {feedback ? <div className="toast-message">{feedback}</div> : null}

      <button type="button" className="floating-cart" onClick={() => setCartOpen(true)}>
        <ShoppingCart size={18} />
        <div>
          <strong>{cartItems.length} itens</strong>
          <span>{formatCurrency(total)}</span>
        </div>
      </button>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onIncrease={(id) => updateQuantity(id, (quantities[id] || 0) + 1)}
        onDecrease={(id) => updateQuantity(id, (quantities[id] || 0) - 1)}
        onRemove={(id) => updateQuantity(id, 0)}
        totals={{ subtotal, deliveryFee, discount, total }}
        form={form}
        onFormChange={(field, value) =>
          setForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "paymentMethod" && value !== "dinheiro"
              ? { needsChange: false, changeFor: "" }
              : {})
          }))
        }
        neighborhoods={neighborhoodOptions}
        onSubmit={handleSubmitOrder}
        submitting={submitting}
      />
    </div>
  );
}

export default StorefrontPage;
