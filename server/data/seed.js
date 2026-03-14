const now = Date.now();
const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days, hour = 18) =>
  new Date(now - days * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000).toISOString();

export const initialData = {
  settings: {
    storeName: "Turbo Drinks",
    tagline: "Geladas em minutos, do jeito que a quebrada gosta.",
    bannerTitle: "Delivery de bebidas com pedido turbo e rastreio ao vivo",
    bannerSubtitle:
      "Monte seu combo, escolha a forma de pagamento e acompanhe cada status pelo celular.",
    addressLine: "Rua Jose Pedro de Brito, 407",
    city: "Vila Santa Rita - Belo Horizonte",
    mapsUrl: "https://maps.app.goo.gl/3PtSGsGTevirUPYKA",
    openingHoursText:
      "*Horario de funcionamento*\n\nQuarta a Sexta: 10h as 22h\nSabado: 10h as 23:59\nDomingo: 10h as 23:59\n\nEstamos esperando seu pedido!",
    whatsappNumber: "5511999999999",
    quickMessage: "Quero fazer um pedido rapido na Turbo Drinks",
    supportText: "Atendimento ate 02h com foco em entregas expressas.",
    deliveryFees: {
      Centro: 5,
      "Jardim America": 7,
      "Vila Nova": 6,
      Industrial: 8,
      Universitario: 4,
      "Parque das Flores": 9
    }
  },
  products: [
    {
      id: "prod-heineken-ln",
      name: "Heineken Long Neck",
      category: "Cervejas",
      volume: "330ml",
      purchasePrice: 6.4,
      salePrice: 8.9,
      stock: 42,
      active: true,
      featured: true,
      badge: "Mais pedida",
      description: "Puro malte gelada para qualquer encontro.",
      image: "/products/beer.svg"
    },
    {
      id: "prod-brahma-duplo",
      name: "Brahma Duplo Malte",
      category: "Cervejas",
      volume: "350ml",
      purchasePrice: 3.2,
      salePrice: 4.9,
      stock: 96,
      active: true,
      featured: false,
      badge: "Leve mais",
      description: "Latinha equilibrada com preco de giro rapido.",
      image: "/products/beer.svg"
    },
    {
      id: "prod-corona-extra",
      name: "Corona Extra",
      category: "Cervejas",
      volume: "355ml",
      purchasePrice: 6.9,
      salePrice: 9.5,
      stock: 30,
      active: true,
      featured: true,
      badge: "Premium",
      description: "Refrescante para curtir com limao e gelo.",
      image: "/products/beer.svg"
    },
    {
      id: "prod-coca-2l",
      name: "Coca-Cola",
      category: "Refrigerantes",
      volume: "2L",
      purchasePrice: 8.7,
      salePrice: 12.9,
      stock: 24,
      active: true,
      featured: true,
      badge: "Familia",
      description: "Perfeita para combos e churrascos.",
      image: "/products/soda.svg"
    },
    {
      id: "prod-guarana-1l",
      name: "Guarana Antarctica",
      category: "Refrigerantes",
      volume: "1L",
      purchasePrice: 5.4,
      salePrice: 7.9,
      stock: 36,
      active: true,
      featured: false,
      badge: "Classico",
      description: "Doce na medida certa para acompanhar o lanche.",
      image: "/products/soda.svg"
    },
    {
      id: "prod-redbull",
      name: "Red Bull",
      category: "Energeticos",
      volume: "250ml",
      purchasePrice: 8.1,
      salePrice: 12.5,
      stock: 48,
      active: true,
      featured: true,
      badge: "Alta energia",
      description: "Ideal para noites longas e combos com destilados.",
      image: "/products/energy.svg"
    },
    {
      id: "prod-monster",
      name: "Monster Energy",
      category: "Energeticos",
      volume: "473ml",
      purchasePrice: 9.8,
      salePrice: 14.9,
      stock: 33,
      active: true,
      featured: false,
      badge: "Lata grande",
      description: "Mais volume para quem quer render a noite toda.",
      image: "/products/energy.svg"
    },
    {
      id: "prod-agua-crystal",
      name: "Agua Crystal",
      category: "Aguas",
      volume: "500ml",
      purchasePrice: 1.4,
      salePrice: 2.9,
      stock: 80,
      active: true,
      featured: false,
      badge: "Hidratacao",
      description: "Pra manter o ritmo da festa com equilibrio.",
      image: "/products/water.svg"
    },
    {
      id: "prod-h2oh",
      name: "H2OH! Limao",
      category: "Aguas",
      volume: "500ml",
      purchasePrice: 4.1,
      salePrice: 6.9,
      stock: 28,
      active: true,
      featured: false,
      badge: "Refrescante",
      description: "Leve, gaseificada e muito pedida no delivery.",
      image: "/products/water.svg"
    },
    {
      id: "prod-delvalle-uva",
      name: "Del Valle Uva",
      category: "Sucos",
      volume: "1L",
      purchasePrice: 6.5,
      salePrice: 9.9,
      stock: 22,
      active: true,
      featured: false,
      badge: "Sem alcool",
      description: "Opcao pratica para a mesa de toda a familia.",
      image: "/products/juice.svg"
    },
    {
      id: "prod-jack-honey",
      name: "Jack Daniel's Honey",
      category: "Destilados",
      volume: "1L",
      purchasePrice: 112.9,
      salePrice: 149.9,
      stock: 12,
      active: true,
      featured: true,
      badge: "Premium",
      description: "Licor de whiskey suave para drinks especiais.",
      image: "/products/spirit.svg"
    },
    {
      id: "prod-smirnoff",
      name: "Vodka Smirnoff",
      category: "Destilados",
      volume: "998ml",
      purchasePrice: 34.9,
      salePrice: 49.9,
      stock: 20,
      active: true,
      featured: false,
      badge: "Rolou festa",
      description: "Base perfeita para drinks e misturas.",
      image: "/products/spirit.svg"
    },
    {
      id: "prod-combo-sextou",
      name: "Combo Sextou",
      category: "Combos e promocoes",
      volume: "6 itens",
      purchasePrice: 58.4,
      salePrice: 79.9,
      stock: 14,
      active: true,
      featured: true,
      badge: "Economize R$ 12,80",
      description: "6 Brahma Duplo Malte + 1 Coca-Cola 2L geladinha.",
      image: "/products/combo.svg"
    },
    {
      id: "prod-combo-balada",
      name: "Combo Balada",
      category: "Combos e promocoes",
      volume: "4 itens",
      purchasePrice: 152.9,
      salePrice: 199.9,
      stock: 8,
      active: true,
      featured: true,
      badge: "Mais completo",
      description: "Jack Honey + 2 Red Bull + gelo de cortesia.",
      image: "/products/combo.svg"
    }
  ],
  promotions: [
    {
      id: "promo-do-dia",
      type: "daily",
      title: "Promocao do dia",
      description: "Long Neck e combo familiar com descontos extras ate 23h59.",
      discountType: "percentage",
      discountValue: 10,
      active: true,
      highlight: "Economia imediata"
    },
    {
      id: "promo-frete-centro",
      type: "shipping",
      title: "Frete gratis Centro",
      description: "Pedidos acima de R$ 80 para o bairro Centro saem sem frete.",
      neighborhood: "Centro",
      minimumOrder: 80,
      active: true,
      highlight: "Frete zero"
    },
    {
      id: "promo-cupom-boasvindas",
      type: "coupon",
      title: "Cupom CHEGUEI",
      description: "Ganhe R$ 10 de desconto no primeiro pedido acima de R$ 70.",
      code: "CHEGUEI",
      discountType: "fixed",
      discountValue: 10,
      minimumOrder: 70,
      active: true,
      highlight: "Cupom ativo"
    },
    {
      id: "promo-combo-duplo",
      type: "combo",
      title: "Combo casal",
      description: "2 Corona + 1 H2OH! por um valor especial na loja.",
      active: true,
      highlight: "Combo especial"
    }
  ],
  customers: [
    {
      id: "customer-ana",
      name: "Ana Paula",
      phone: "11988887777",
      address: "Rua das Flores, 120",
      neighborhood: "Centro",
      notes: "Casa azul, portao branco.",
      totalSpent: 128.4,
      orderIds: ["order-1002"],
      lastOrderId: "order-1002",
      createdAt: daysAgo(18),
      updatedAt: hoursAgo(2)
    },
    {
      id: "customer-diego",
      name: "Diego Santos",
      phone: "11977776666",
      address: "Av. Brasil, 450",
      neighborhood: "Jardim America",
      notes: "Apartamento 203.",
      totalSpent: 219.8,
      orderIds: ["order-1001"],
      lastOrderId: "order-1001",
      createdAt: daysAgo(30),
      updatedAt: hoursAgo(6)
    }
  ],
  orders: [
    {
      id: "order-1001",
      number: 1001,
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(1),
      customerId: "customer-diego",
      customer: {
        name: "Diego Santos",
        phone: "11977776666",
        address: "Av. Brasil, 450",
        neighborhood: "Jardim America",
        note: "Apartamento 203."
      },
      items: [
        {
          productId: "prod-jack-honey",
          name: "Jack Daniel's Honey",
          volume: "1L",
          unitPrice: 149.9,
          quantity: 1,
          lineTotal: 149.9
        },
        {
          productId: "prod-redbull",
          name: "Red Bull",
          volume: "250ml",
          unitPrice: 12.5,
          quantity: 2,
          lineTotal: 25
        }
      ],
      paymentMethod: "cartao",
      changeFor: null,
      couponCode: "",
      subtotal: 174.9,
      deliveryFee: 7,
      discount: 0,
      total: 181.9,
      status: "out_for_delivery",
      statusTimeline: [
        { "status": "received", "timestamp": hoursAgo(6) },
        { "status": "accepted", "timestamp": hoursAgo(5.5) },
        { "status": "preparing", "timestamp": hoursAgo(4.5) },
        { "status": "out_for_delivery", "timestamp": hoursAgo(1) }
      ]
    },
    {
      id: "order-1002",
      number: 1002,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(0.5),
      customerId: "customer-ana",
      customer: {
        name: "Ana Paula",
        phone: "11988887777",
        address: "Rua das Flores, 120",
        neighborhood: "Centro",
        note: "Casa azul, portao branco."
      },
      items: [
        {
          productId: "prod-combo-sextou",
          name: "Combo Sextou",
          volume: "6 itens",
          unitPrice: 79.9,
          quantity: 1,
          lineTotal: 79.9
        },
        {
          productId: "prod-agua-crystal",
          name: "Agua Crystal",
          volume: "500ml",
          unitPrice: 2.9,
          quantity: 3,
          lineTotal: 8.7
        }
      ],
      paymentMethod: "pix",
      changeFor: null,
      couponCode: "CHEGUEI",
      subtotal: 88.6,
      deliveryFee: 0,
      discount: 10,
      total: 78.6,
      status: "delivered",
      statusTimeline: [
        { "status": "received", "timestamp": hoursAgo(2) },
        { "status": "accepted", "timestamp": hoursAgo(1.8) },
        { "status": "preparing", "timestamp": hoursAgo(1.4) },
        { "status": "out_for_delivery", "timestamp": hoursAgo(1) },
        { "status": "delivered", "timestamp": hoursAgo(0.5) }
      ]
    }
  ]
};
