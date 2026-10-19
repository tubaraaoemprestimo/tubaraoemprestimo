-- ROLLBACK do modulo de celulares. Apaga SOMENTE as tabelas novas.
-- Use apenas se nenhum dado real de celulares precisar ser mantido (faca backup antes).
BEGIN;
DROP TABLE IF EXISTS "device_custody_events","mdm_command_events","mdm_commands","apple_mdm_devices",
 "phone_collection_events","device_release_steps","phone_release_cases","phone_delivery_receipts",
 "phone_contracts","phone_payment_allocations","phone_sale_payments","phone_sale_installments",
 "phone_sales","phone_device_reservations","phone_application_audits","phone_application_documents",
 "phone_financing_applications","phone_inventory_units","phone_skus","phone_products",
 "phone_financing_settings","service_catalog_entries";
COMMIT;
