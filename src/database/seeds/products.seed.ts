export type ModifierGroupSeed = {
  id: string;
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: {
    id: string;
    name: string;
    priceDelta: number;
    isDefault: boolean;
    sortOrder: number;
  }[];
};

export type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  basePrice: number;
  station: 'KOPI' | 'MAKANAN';
  modifiers: string[];
  prepTimeMinutes: number;
};

export type OutletSeed = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  cutoffHour: number;
};

export type UserSeed = {
  id: string;
  email: string;
  name: string;
  roleCode: 'SUPER_ADMIN' | 'MANAGER_OUTLET' | 'KASIR' | 'KOKI' | 'PELANGGAN';
};

export type CategorySeed = { id: string; name: string; sortOrder: number };

export type TableSeed = { id: string; label: string; area: string; seats: number };

export type IngredientSeed = { id: string; sku: string; name: string; unit: string; costPerUnit: number };

export type RecipeSeed = {
  productSku: string;
  yieldQty: number;
  items: { ingredientSku: string; qty: number; unit: string }[];
};

export const OUTLET: OutletSeed = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'KTA',
  name: 'SARKO Kartasura',
  timezone: 'Asia/Jakarta',
  cutoffHour: 4,
};

export const USERS: UserSeed[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    email: 'superadmin@sarko.id',
    name: 'Super Admin',
    roleCode: 'SUPER_ADMIN',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    email: 'manager@sarko.id',
    name: 'Manajer Outlet',
    roleCode: 'MANAGER_OUTLET',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    email: 'kasir@sarko.id',
    name: 'Kasir Kartasura',
    roleCode: 'KASIR',
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    email: 'koki@sarko.id',
    name: 'Koki Kartasura',
    roleCode: 'KOKI',
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    email: 'pelanggan@sarko.id',
    name: 'Pelanggan Contoh',
    roleCode: 'PELANGGAN',
  },
];

export const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin' },
  { code: 'MANAGER_OUTLET', name: 'Manajer Outlet' },
  { code: 'KASIR', name: 'Kasir' },
  { code: 'KOKI', name: 'Koki' },
  { code: 'PELANGGAN', name: 'Pelanggan' },
] as const;

export const CATEGORIES: CategorySeed[] = [
  { id: '00000000-0000-4000-8000-000000000201', name: 'Kopi', sortOrder: 1 },
  { id: '00000000-0000-4000-8000-000000000202', name: 'Roti', sortOrder: 2 },
  { id: '00000000-0000-4000-8000-000000000203', name: 'Makanan', sortOrder: 3 },
  { id: '00000000-0000-4000-8000-000000000204', name: 'Minuman', sortOrder: 4 },
];

export const MODIFIER_GROUPS: ModifierGroupSeed[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    name: 'Ukuran',
    selectionType: 'SINGLE',
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 1,
    options: [
      { id: '00000000-0000-4000-8000-000000000311', name: 'Regular', priceDelta: 0, isDefault: true, sortOrder: 1 },
      { id: '00000000-0000-4000-8000-000000000312', name: 'Large', priceDelta: 2_000, isDefault: false, sortOrder: 2 },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    name: 'Kemanisan',
    selectionType: 'SINGLE',
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 2,
    options: [
      { id: '00000000-0000-4000-8000-000000000321', name: 'Normal', priceDelta: 0, isDefault: true, sortOrder: 1 },
      { id: '00000000-0000-4000-8000-000000000322', name: 'Less Sugar', priceDelta: 0, isDefault: false, sortOrder: 2 },
      { id: '00000000-0000-4000-8000-000000000323', name: 'No Sugar', priceDelta: 0, isDefault: false, sortOrder: 3 },
    ],
  },
];

export const TABLES: TableSeed[] = Array.from({ length: 8 }, (_, index) => ({
  id: `00000000-0000-4000-8000-0000000004${String(index + 1).padStart(2, '0')}`,
  label: `Meja ${String(index + 1).padStart(2, '0')}`,
  area: index < 4 ? 'Indoor' : 'Outdoor',
  seats: index % 2 === 0 ? 2 : 4,
}));

export const INGREDIENTS: IngredientSeed[] = [
  { id: '00000000-0000-4000-8000-000000000501', sku: 'ING-KOPI', name: 'Kopi Bubuk', unit: 'GRAM', costPerUnit: 200 },
  { id: '00000000-0000-4000-8000-000000000502', sku: 'ING-SUSU', name: 'Susu UHT', unit: 'ML', costPerUnit: 15 },
  { id: '00000000-0000-4000-8000-000000000503', sku: 'ING-GULA', name: 'Gula Aren', unit: 'GRAM', costPerUnit: 30 },
  { id: '00000000-0000-4000-8000-000000000504', sku: 'ING-TEPUNG', name: 'Tepung Terigu', unit: 'GRAM', costPerUnit: 12 },
  { id: '00000000-0000-4000-8000-000000000505', sku: 'ING-MENTEGA', name: 'Mentega', unit: 'GRAM', costPerUnit: 90 },
  { id: '00000000-0000-4000-8000-000000000506', sku: 'ING-TELUR', name: 'Telur', unit: 'PCS', costPerUnit: 2_500 },
];

export const RECIPES: RecipeSeed[] = [
  {
    productSku: 'KOPI-001',
    yieldQty: 1,
    items: [
      { ingredientSku: 'ING-KOPI', qty: 15, unit: 'GRAM' },
      { ingredientSku: 'ING-SUSU', qty: 120, unit: 'ML' },
      { ingredientSku: 'ING-GULA', qty: 20, unit: 'GRAM' },
    ],
  },
  {
    productSku: 'ROTI-001',
    yieldQty: 1,
    items: [
      { ingredientSku: 'ING-TEPUNG', qty: 80, unit: 'GRAM' },
      { ingredientSku: 'ING-MENTEGA', qty: 20, unit: 'GRAM' },
      { ingredientSku: 'ING-TELUR', qty: 1, unit: 'PCS' },
    ],
  },
  {
    productSku: 'MAKAN-001',
    yieldQty: 1,
    items: [
      { ingredientSku: 'ING-TEPUNG', qty: 60, unit: 'GRAM' },
      { ingredientSku: 'ING-TELUR', qty: 2, unit: 'PCS' },
    ],
  },
];

export const PRODUCTS: ProductSeed[] = [
  { sku: 'KOPI-001', name: 'Kopi Butter', category: 'Kopi', basePrice: 18_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 3 },
  { sku: 'KOPI-002', name: 'Americano', category: 'Kopi', basePrice: 15_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 2 },
  { sku: 'KOPI-003', name: 'Cappuccino', category: 'Kopi', basePrice: 22_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 4 },
  { sku: 'KOPI-004', name: 'Latte', category: 'Kopi', basePrice: 24_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 4 },
  { sku: 'KOPI-005', name: 'Espresso', category: 'Kopi', basePrice: 14_000, station: 'KOPI', modifiers: ['Kemanisan'], prepTimeMinutes: 2 },
  { sku: 'KOPI-006', name: 'Kopi Susu Aren', category: 'Kopi', basePrice: 20_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 3 },

  { sku: 'ROTI-001', name: 'Roti Bakar Butter', category: 'Roti', basePrice: 15_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 5 },
  { sku: 'ROTI-002', name: 'Roti Bakar Coklat', category: 'Roti', basePrice: 17_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 5 },
  { sku: 'ROTI-003', name: 'Croissant', category: 'Roti', basePrice: 19_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 2 },
  { sku: 'ROTI-004', name: 'Donat Gula', category: 'Roti', basePrice: 12_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 1 },
  { sku: 'ROTI-005', name: 'Banana Bread', category: 'Roti', basePrice: 21_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 2 },

  { sku: 'MAKAN-001', name: 'Nasi Goreng SARKO', category: 'Makanan', basePrice: 28_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 10 },
  { sku: 'MAKAN-002', name: 'Mie Goreng Spesial', category: 'Makanan', basePrice: 26_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 9 },
  { sku: 'MAKAN-003', name: 'Ayam Geprek', category: 'Makanan', basePrice: 25_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 8 },
  { sku: 'MAKAN-004', name: 'Kentang Goreng', category: 'Makanan', basePrice: 18_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 6 },
  { sku: 'MAKAN-005', name: 'Pisang Goreng Keju', category: 'Makanan', basePrice: 20_000, station: 'MAKANAN', modifiers: [], prepTimeMinutes: 7 },

  { sku: 'MINUM-001', name: 'Es Teh Manis', category: 'Minuman', basePrice: 8_000, station: 'KOPI', modifiers: ['Kemanisan'], prepTimeMinutes: 2 },
  { sku: 'MINUM-002', name: 'Es Jeruk', category: 'Minuman', basePrice: 10_000, station: 'KOPI', modifiers: ['Kemanisan'], prepTimeMinutes: 2 },
  { sku: 'MINUM-003', name: 'Air Mineral', category: 'Minuman', basePrice: 6_000, station: 'KOPI', modifiers: [], prepTimeMinutes: 0 },
  { sku: 'MINUM-004', name: 'Matcha Latte', category: 'Minuman', basePrice: 23_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 4 },
  { sku: 'MINUM-005', name: 'Chocolate', category: 'Minuman', basePrice: 21_000, station: 'KOPI', modifiers: ['Ukuran', 'Kemanisan'], prepTimeMinutes: 4 },
];
