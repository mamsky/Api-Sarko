import { relations } from 'drizzle-orm';

import { category, modifierGroup, modifierOption, product, productModifierGroup } from './catalog';
import { ingredient, recipe, recipeItem, stockLevel } from './inventory';
import { loyaltyAccount, loyaltyLedger } from './loyalty';
import { device, outlet, role, user, userOutlet } from './identity';
import { order, orderItem, orderItemModifier, orderStatusHistory, shift } from './ordering';
import { payment, refund } from './payment';
import { promotion, voucher, voucherRedemption } from './promotion';

/**
 * Relasi Drizzle (dipakai `db.query.*`).
 * Arah: order → items → modifiers, product → modifier_groups.
 */

export const outletRelations = relations(outlet, ({ many }) => ({
  users: many(userOutlet),
  orders: many(order),
  devices: many(device),
  categories: many(category),
  products: many(product),
  shifts: many(shift),
}));

export const userRelations = relations(user, ({ many }) => ({
  outlets: many(userOutlet),
  orders: many(order),
}));

export const userOutletRelations = relations(userOutlet, ({ one }) => ({
  user: one(user, { fields: [userOutlet.userId], references: [user.id] }),
  outlet: one(outlet, { fields: [userOutlet.outletId], references: [outlet.id] }),
}));

export const roleRelations = relations(role, () => ({}));

export const deviceRelations = relations(device, ({ one }) => ({
  outlet: one(outlet, { fields: [device.outletId], references: [outlet.id] }),
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
  outlet: one(outlet, { fields: [category.outletId], references: [outlet.id] }),
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, { fields: [product.categoryId], references: [category.id] }),
  modifierGroups: many(productModifierGroup),
  recipes: many(recipe),
  orderItems: many(orderItem),
}));

export const modifierGroupRelations = relations(modifierGroup, ({ many }) => ({
  options: many(modifierOption),
  products: many(productModifierGroup),
}));

export const modifierOptionRelations = relations(modifierOption, ({ one }) => ({
  group: one(modifierGroup, {
    fields: [modifierOption.modifierGroupId],
    references: [modifierGroup.id],
  }),
}));

export const productModifierGroupRelations = relations(productModifierGroup, ({ one }) => ({
  product: one(product, {
    fields: [productModifierGroup.productId],
    references: [product.id],
  }),
  modifierGroup: one(modifierGroup, {
    fields: [productModifierGroup.modifierGroupId],
    references: [modifierGroup.id],
  }),
}));

export const ingredientRelations = relations(ingredient, ({ many }) => ({
  recipeItems: many(recipeItem),
  stockLevels: many(stockLevel),
}));

export const recipeRelations = relations(recipe, ({ one, many }) => ({
  product: one(product, { fields: [recipe.productId], references: [product.id] }),
  items: many(recipeItem),
}));

export const recipeItemRelations = relations(recipeItem, ({ one }) => ({
  recipe: one(recipe, { fields: [recipeItem.recipeId], references: [recipe.id] }),
  ingredient: one(ingredient, {
    fields: [recipeItem.ingredientId],
    references: [ingredient.id],
  }),
}));

export const stockLevelRelations = relations(stockLevel, ({ one }) => ({
  ingredient: one(ingredient, {
    fields: [stockLevel.ingredientId],
    references: [ingredient.id],
  }),
}));

export const shiftRelations = relations(shift, ({ one, many }) => ({
  outlet: one(outlet, { fields: [shift.outletId], references: [outlet.id] }),
  orders: many(order),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
  outlet: one(outlet, { fields: [order.outletId], references: [outlet.id] }),
  shift: one(shift, { fields: [order.shiftId], references: [shift.id] }),
  items: many(orderItem),
  payments: many(payment),
  refunds: many(refund),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemRelations = relations(orderItem, ({ one, many }) => ({
  order: one(order, { fields: [orderItem.orderId], references: [order.id] }),
  product: one(product, { fields: [orderItem.productId], references: [product.id] }),
  modifiers: many(orderItemModifier),
}));

export const orderItemModifierRelations = relations(orderItemModifier, ({ one }) => ({
  item: one(orderItem, {
    fields: [orderItemModifier.orderItemId],
    references: [orderItem.id],
  }),
  option: one(modifierOption, {
    fields: [orderItemModifier.modifierOptionId],
    references: [modifierOption.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(order, { fields: [orderStatusHistory.orderId], references: [order.id] }),
}));

export const paymentRelations = relations(payment, ({ one, many }) => ({
  order: one(order, { fields: [payment.orderId], references: [order.id] }),
  refunds: many(refund),
}));

export const refundRelations = relations(refund, ({ one }) => ({
  payment: one(payment, { fields: [refund.paymentId], references: [payment.id] }),
  order: one(order, { fields: [refund.orderId], references: [order.id] }),
}));

export const promotionRelations = relations(promotion, ({ many }) => ({
  vouchers: many(voucher),
}));

export const voucherRelations = relations(voucher, ({ one, many }) => ({
  promotion: one(promotion, { fields: [voucher.promotionId], references: [promotion.id] }),
  redemptions: many(voucherRedemption),
}));

export const voucherRedemptionRelations = relations(voucherRedemption, ({ one }) => ({
  voucher: one(voucher, { fields: [voucherRedemption.voucherId], references: [voucher.id] }),
  order: one(order, { fields: [voucherRedemption.orderId], references: [order.id] }),
}));

export const loyaltyAccountRelations = relations(loyaltyAccount, ({ many }) => ({
  ledger: many(loyaltyLedger),
}));

export const loyaltyLedgerRelations = relations(loyaltyLedger, ({ one }) => ({
  account: one(loyaltyAccount, {
    fields: [loyaltyLedger.accountId],
    references: [loyaltyAccount.id],
  }),
  order: one(order, { fields: [loyaltyLedger.orderId], references: [order.id] }),
}));
