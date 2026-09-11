"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Toda tela nova do admin entra aqui — é o menu principal.
const SECTIONS = [
  { href: "/admin", label: "Posts" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/metricas", label: "Métricas" },
  { href: "/admin/atividade", label: "Atividade" },
  { href: "/admin/usuarios", label: "Usuários" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {SECTIONS.map((section) => {
        // "/admin" só fica ativo nele mesmo e no editor de post; as outras
        // seções pegam suas subpáginas.
        const active =
          section.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/posts")
            : pathname.startsWith(section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={`admin-nav-link${active ? " admin-nav-link-active" : ""}`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
