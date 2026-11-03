CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"device_name" varchar(100) NOT NULL,
	"device_type" varchar(16) NOT NULL,
	"platform" varchar(16) NOT NULL,
	"app_version" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_heartbeat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"app_version" varchar(32),
	"queue_depth" integer DEFAULT 0 NOT NULL,
	"clock_skew_ms" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(120) NOT NULL,
	"address" text,
	"phone" varchar(32),
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"cutoff_hour" integer DEFAULT 4 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pin_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"success" boolean NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(96) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(160) NOT NULL,
	"name" varchar(120) NOT NULL,
	"phone" varchar(32),
	"password_hash" text NOT NULL,
	"pin_hash" text,
	"role_code" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_outlet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modifier_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid,
	"name" varchar(80) NOT NULL,
	"selection_type" varchar(16) DEFAULT 'SINGLE' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modifier_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"price_delta" bigint DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"sku" varchar(48) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"base_price" bigint NOT NULL,
	"image_url" text,
	"station" varchar(16) DEFAULT 'KOPI' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"prep_time_minutes" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_modifier_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"sku" varchar(48) NOT NULL,
	"name" varchar(120) NOT NULL,
	"unit" varchar(16) DEFAULT 'GRAM' NOT NULL,
	"cost_per_unit" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"yield_qty" numeric(10, 3) DEFAULT '1' NOT NULL,
	"hpp" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recipe_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit" varchar(16) DEFAULT 'GRAM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty_on_hand" numeric(14, 3) DEFAULT '0' NOT NULL,
	"qty_reserved" numeric(14, 3) DEFAULT '0' NOT NULL,
	"low_stock_threshold" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"order_id" uuid,
	"type" varchar(32) NOT NULL,
	"qty_delta" numeric(14, 3) NOT NULL,
	"qty_after" numeric(14, 3),
	"reference" varchar(128),
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_drop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"denomination_breakdown" jsonb,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dining_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"area" varchar(50),
	"seats" integer DEFAULT 2 NOT NULL,
	"qr_token" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_id" uuid,
	"shift_id" uuid,
	"prefix" varchar(32) NOT NULL,
	"range_start" bigint NOT NULL,
	"range_end" bigint NOT NULL,
	"next_value" bigint NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_no" varchar(48) NOT NULL,
	"client_order_id" varchar(64),
	"shift_id" uuid,
	"device_id" uuid,
	"user_id" uuid,
	"customer_id" uuid,
	"table_id" uuid,
	"table_label" varchar(50),
	"channel" varchar(16) NOT NULL,
	"fulfillment" varchar(16) NOT NULL,
	"status" varchar(24) NOT NULL,
	"payment_method" varchar(16) NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"rounding_adjustment" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"cash_received" bigint,
	"change_due" bigint,
	"discount_code" varchar(50),
	"notes" text,
	"business_date" varchar(10) NOT NULL,
	"clock_skew_ms" integer,
	"paid_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(120) NOT NULL,
	"sku" varchar(48),
	"qty" integer NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"modifier_total" bigint DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"station" varchar(16) DEFAULT 'KOPI' NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"notes" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_modifier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"modifier_option_id" uuid NOT NULL,
	"modifier_group_name" varchar(80),
	"name" varchar(80) NOT NULL,
	"price_delta" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" varchar(24),
	"to_status" varchar(24) NOT NULL,
	"actor_id" uuid,
	"device_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_id" uuid,
	"opened_by_user_id" uuid NOT NULL,
	"closed_by_user_id" uuid,
	"status" varchar(16) DEFAULT 'OPEN' NOT NULL,
	"opening_cash" bigint DEFAULT 0 NOT NULL,
	"closing_cash" bigint DEFAULT 0 NOT NULL,
	"expected_cash" bigint DEFAULT 0 NOT NULL,
	"variance" bigint DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"method" varchar(16) NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'PENDING' NOT NULL,
	"gateway_reference" varchar(128),
	"idempotency_key" varchar(128),
	"gateway_payload" jsonb,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid,
	"gateway_reference" varchar(128),
	"event" varchar(32) NOT NULL,
	"signature_valid" varchar(8) DEFAULT 'true' NOT NULL,
	"raw_body" text NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(16) DEFAULT 'REQUESTED' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"gateway_reference" varchar(128),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"business_date" varchar(10) NOT NULL,
	"system_total" bigint DEFAULT 0 NOT NULL,
	"gateway_total" bigint DEFAULT 0 NOT NULL,
	"cash_total" bigint DEFAULT 0 NOT NULL,
	"variance" bigint DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"tier" varchar(16) DEFAULT 'BRONZE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"order_id" uuid,
	"type" varchar(32) NOT NULL,
	"points_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference" varchar(128),
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(64) NOT NULL,
	"min_lifetime_points" integer DEFAULT 0 NOT NULL,
	"multiplier_bps" bigint DEFAULT 10000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"discount_type" varchar(16) DEFAULT 'PERCENT' NOT NULL,
	"discount_bps" integer DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"max_discount" bigint DEFAULT 0 NOT NULL,
	"min_purchase" bigint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"stacking_rule" varchar(16) DEFAULT 'EXCLUSIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"promotion_id" uuid,
	"code" varchar(50) NOT NULL,
	"max_redemptions" integer DEFAULT 0 NOT NULL,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"max_per_customer" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_command_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"command_id" varchar(64) NOT NULL,
	"command_type" varchar(32) NOT NULL,
	"aggregate_id" varchar(128),
	"payload_hash" varchar(64) NOT NULL,
	"result" varchar(16) NOT NULL,
	"http_status" bigint DEFAULT 200 NOT NULL,
	"response_body" jsonb,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_conflict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"order_id" uuid,
	"type" varchar(32) NOT NULL,
	"device_value" jsonb,
	"cloud_value" jsonb,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid,
	"actor_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip_address" varchar(64),
	"trace_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_date" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"business_date" varchar(10) NOT NULL,
	"status" varchar(16) DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp with time zone,
	"total_sales" bigint DEFAULT 0 NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid,
	"channel" varchar(16) NOT NULL,
	"template" varchar(64) NOT NULL,
	"recipient" varchar(160) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"payload" jsonb,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid,
	"aggregate_type" varchar(32) NOT NULL,
	"aggregate_id" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"rate_bps" integer DEFAULT 1000 NOT NULL,
	"service_charge_bps" integer DEFAULT 0 NOT NULL,
	"is_inclusive" varchar(8) DEFAULT 'false' NOT NULL,
	"is_active" varchar(8) DEFAULT 'true' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "device_device_id_uq" ON "device" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_outlet_status_idx" ON "device" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "device_heartbeat_device_seen_idx" ON "device_heartbeat" USING btree ("device_id","seen_at");--> statement-breakpoint
CREATE INDEX "device_heartbeat_outlet_created_idx" ON "device_heartbeat" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_code_uq" ON "outlet" USING btree ("code");--> statement-breakpoint
CREATE INDEX "pin_attempt_user_created_idx" ON "pin_attempt" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_token_hash_uq" ON "refresh_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_token_user_idx" ON "refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_code_uq" ON "role" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "system_setting_key_uq" ON "system_setting" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uq" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role_code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_outlet_uq" ON "user_outlet" USING btree ("user_id","outlet_id");--> statement-breakpoint
CREATE INDEX "user_outlet_outlet_idx" ON "user_outlet" USING btree ("outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "category_outlet_name_uq" ON "category" USING btree ("outlet_id","name");--> statement-breakpoint
CREATE INDEX "category_outlet_created_idx" ON "category" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "modifier_group_outlet_name_uq" ON "modifier_group" USING btree ("outlet_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "modifier_option_group_name_uq" ON "modifier_option" USING btree ("modifier_group_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_outlet_sku_uq" ON "product" USING btree ("outlet_id","sku");--> statement-breakpoint
CREATE INDEX "product_outlet_category_idx" ON "product" USING btree ("outlet_id","category_id");--> statement-breakpoint
CREATE INDEX "product_outlet_created_idx" ON "product" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_modifier_group_uq" ON "product_modifier_group" USING btree ("product_id","modifier_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_outlet_sku_uq" ON "ingredient" USING btree ("outlet_id","sku");--> statement-breakpoint
CREATE INDEX "ingredient_outlet_created_idx" ON "ingredient" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_product_uq" ON "recipe" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "recipe_outlet_created_idx" ON "recipe" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_item_uq" ON "recipe_item" USING btree ("recipe_id","ingredient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_level_outlet_ingredient_uq" ON "stock_level" USING btree ("outlet_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "stock_movement_outlet_created_idx" ON "stock_movement" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_ingredient_created_idx" ON "stock_movement" USING btree ("ingredient_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_order_idx" ON "stock_movement" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservation_order_ingredient_uq" ON "stock_reservation" USING btree ("order_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "stock_reservation_outlet_status_idx" ON "stock_reservation" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "cash_drop_outlet_created_idx" ON "cash_drop" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "cash_drop_shift_idx" ON "cash_drop" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dining_table_outlet_label_uq" ON "dining_table" USING btree ("outlet_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "dining_table_qr_token_uq" ON "dining_table" USING btree ("qr_token");--> statement-breakpoint
CREATE UNIQUE INDEX "number_block_outlet_prefix_device_uq" ON "number_block" USING btree ("outlet_id","prefix","device_id");--> statement-breakpoint
CREATE INDEX "number_block_outlet_prefix_idx" ON "number_block" USING btree ("outlet_id","prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "order_outlet_order_no_uq" ON "order" USING btree ("outlet_id","order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "order_client_order_id_uq" ON "order" USING btree ("client_order_id");--> statement-breakpoint
CREATE INDEX "order_outlet_created_idx" ON "order" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "order_outlet_status_idx" ON "order" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "order_outlet_business_date_idx" ON "order" USING btree ("outlet_id","business_date");--> statement-breakpoint
CREATE INDEX "order_status_created_idx" ON "order" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_outlet_created_idx" ON "order_item" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "order_item_station_status_idx" ON "order_item" USING btree ("station","status");--> statement-breakpoint
CREATE INDEX "order_item_modifier_item_idx" ON "order_item_modifier" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_item_modifier_outlet_created_idx" ON "order_item_modifier" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "order_status_history_order_created_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_status_history_outlet_created_idx" ON "order_status_history" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "shift_outlet_status_idx" ON "shift" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "shift_outlet_created_idx" ON "shift" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_reference_uq" ON "payment" USING btree ("gateway_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_key_uq" ON "payment" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_order_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_outlet_created_idx" ON "payment" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_outlet_status_idx" ON "payment" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE INDEX "payment_webhook_log_ref_idx" ON "payment_webhook_log" USING btree ("gateway_reference");--> statement-breakpoint
CREATE INDEX "payment_webhook_log_created_idx" ON "payment_webhook_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refund_payment_idx" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refund_order_idx" ON "refund" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_outlet_created_idx" ON "refund" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_outlet_date_uq" ON "settlement" USING btree ("outlet_id","business_date");--> statement-breakpoint
CREATE INDEX "settlement_outlet_created_idx" ON "settlement" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_account_outlet_customer_uq" ON "loyalty_account" USING btree ("outlet_id","customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_account_outlet_created_idx" ON "loyalty_account" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_ledger_account_created_idx" ON "loyalty_ledger" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_ledger_order_idx" ON "loyalty_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "loyalty_ledger_outlet_created_idx" ON "loyalty_ledger" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_tier_outlet_code_uq" ON "loyalty_tier" USING btree ("outlet_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_outlet_code_uq" ON "promotion" USING btree ("outlet_id","code");--> statement-breakpoint
CREATE INDEX "promotion_outlet_active_idx" ON "promotion" USING btree ("outlet_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "voucher_outlet_code_uq" ON "voucher" USING btree ("outlet_id","code");--> statement-breakpoint
CREATE INDEX "voucher_outlet_created_idx" ON "voucher" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voucher_redemption_voucher_order_uq" ON "voucher_redemption" USING btree ("voucher_id","order_id");--> statement-breakpoint
CREATE INDEX "voucher_redemption_outlet_created_idx" ON "voucher_redemption" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_command_log_command_id_uq" ON "sync_command_log" USING btree ("command_id");--> statement-breakpoint
CREATE INDEX "sync_command_log_outlet_created_idx" ON "sync_command_log" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "sync_command_log_device_created_idx" ON "sync_command_log" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "sync_conflict_outlet_type_idx" ON "sync_conflict" USING btree ("outlet_id","type");--> statement-breakpoint
CREATE INDEX "sync_conflict_order_idx" ON "sync_conflict" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sync_conflict_outlet_created_idx" ON "sync_conflict" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_created_idx" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_outlet_created_idx" ON "audit_log" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_date_outlet_date_uq" ON "business_date" USING btree ("outlet_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_key_key_actor_uq" ON "idempotency_key" USING btree ("key","actor_id");--> statement-breakpoint
CREATE INDEX "idempotency_key_expires_idx" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "notification_log_status_created_idx" ON "notification_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notification_log_outlet_created_idx" ON "notification_log" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_event_status_available_idx" ON "outbox_event" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_event_aggregate_idx" ON "outbox_event" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "outbox_event_outlet_created_idx" ON "outbox_event" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_config_outlet_name_uq" ON "tax_config" USING btree ("outlet_id","name");