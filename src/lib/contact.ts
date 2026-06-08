import { BUSINESS } from "@/lib/seo/site-config";

export const CONTACT_PHONE = BUSINESS.phone;
export const CONTACT_WHATSAPP = BUSINESS.whatsapp;
export const CONTACT_WHATSAPP_DIGITS = BUSINESS.whatsapp.replace(/\D/g, "");

export const WHATSAPP_API_BASE = `https://api.whatsapp.com/send/?phone=${CONTACT_WHATSAPP_DIGITS}`;
export const WHATSAPP_WA_ME_BASE = `https://wa.me/${CONTACT_WHATSAPP_DIGITS}`;

export const WHATSAPP_DEFAULT_LINK =
  `${WHATSAPP_API_BASE}&text=${encodeURIComponent("Hola, quiero asesoria comercial en Vehiculos de Ocasion")}&type=phone_number&app_absent=0`;
