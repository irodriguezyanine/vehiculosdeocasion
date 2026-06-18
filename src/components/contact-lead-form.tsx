"use client";

import { useMemo, useState } from "react";
import { WHATSAPP_API_BASE } from "@/lib/contact";

type LeadForm = {
  name: string;
  phone: string;
  interest: string;
};

export function ContactLeadForm() {
  const [form, setForm] = useState<LeadForm>({ name: "", phone: "", interest: "" });
  const [message, setMessage] = useState("");

  const whatsappUrl = useMemo(() => {
    const text = `Hola, soy ${form.name || "cliente"} y me interesa ${form.interest || "recibir asesoría comercial"}. Mi contacto: ${form.phone || "sin teléfono"}.`;
    return `${WHATSAPP_API_BASE}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
  }, [form]);

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setMessage("Completa nombre y teléfono para continuar.");
      return;
    }
    setMessage("Perfecto. Te estamos redirigiendo a WhatsApp para contacto inmediato.");
    window.open(whatsappUrl, "_blank", "noreferrer");
  };

  return (
    <div className="section-shell">
      <p className="premium-kicker">Asesoría personalizada</p>
      <h2 className="text-2xl font-bold text-slate-900">Te ayudamos a encontrar tu próxima unidad</h2>
      <p className="mt-2 text-sm text-slate-600">
        Déjanos tus datos y te contactamos por WhatsApp para guiarte en la compra de tu vehículo.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="ui-focus min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
          placeholder="Nombre"
          aria-label="Nombre de contacto"
          autoComplete="name"
        />
        <input
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          className="ui-focus min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
          placeholder="Teléfono"
          aria-label="Teléfono de contacto"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
        <input
          value={form.interest}
          onChange={(event) => setForm((prev) => ({ ...prev, interest: event.target.value }))}
          className="ui-focus min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
          placeholder="¿Qué vehículo buscas?"
          aria-label="Interés de vehículo"
        />
        <button
          type="button"
          onClick={submit}
          className="ui-focus min-h-11 rounded-md bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          Solicitar asesoría
        </button>
      </div>
      {message ? <p className="mt-2 text-xs font-semibold text-cyan-800">{message}</p> : null}
    </div>
  );
}
