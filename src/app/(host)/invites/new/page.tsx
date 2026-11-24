import type { Metadata } from "next";

import { create } from "@/copy/en";

import { CreateForm } from "./CreateForm";

export const metadata: Metadata = { title: "Create invitation" };

export default function NewInvitePage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="sr-only">{create.title}</h1>
      <CreateForm />
    </section>
  );
}
